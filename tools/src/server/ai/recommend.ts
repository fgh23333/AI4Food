import type { IndexEntry, RestaurantEnums, RecommendResponse, RecommendPick } from '../../types'
import { retrieve } from './retrieve'
import { buildRecommendPrompt, buildRecommendStreamPrompt } from './prompt'
import { parseJsonResponse, MODEL, type LlmClient, GATEWAY_ID } from './llm'
import type { TraceContext } from '../observability/tracer'

// LLM 单次返回的原始结构（picks 的 id 可能不存在于候选集，需校验）
interface LlmRecommendResult {
  answer?: unknown
  picks?: unknown
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// qwen 流式模式下偶发畸形：把 pick 的字段拼成单个 key
// （如 {"id:x,name:y,reason:z,score": 0.9}）。尝试拆解还原；正常多 key 对象返回 null（不处理）。
function repairPick(obj: Record<string, unknown>): { id?: string; name?: string; reason?: string; score?: number } | null {
  const keys = Object.keys(obj)
  if (keys.length > 1) return null
  const key = keys[0]
  if (!key || !key.includes(':')) return null
  const out: { id?: string; name?: string; reason?: string; score?: number } = {}
  const val = obj[key]
  if (typeof val === 'number') out.score = val
  for (const part of key.split(',')) {
    const ci = part.indexOf(':')
    if (ci === -1) continue
    const k = part.slice(0, ci).trim()
    const v = part.slice(ci + 1).trim()
    if (k === 'id') out.id = v
    else if (k === 'name') out.name = v
    else if (k === 'reason') out.reason = v
    else if (k === 'score' && out.score === undefined) out.score = Number(v)
  }
  return out.id || out.name ? out : null
}

// 校验 picks：先尝试畸形修复，再 id 优先匹配候选集，id 无效时按 name 回退。
// 无匹配或重复的 pick 丢弃（防幻觉）。recommend 与 recommendStream 共用。
function validatePicks(
  parsed: LlmRecommendResult,
  candidates: IndexEntry[],
): { picks: RecommendPick[]; dropped: number } {
  const idToEntry = new Map(candidates.map((c) => [c.id, c]))
  // 名字回退表：连锁同名多家时取代表（首个）
  const nameToEntry = new Map<string, IndexEntry>()
  for (const c of candidates) if (!nameToEntry.has(c.name)) nameToEntry.set(c.name, c)
  const rawPicks = Array.isArray(parsed.picks) ? parsed.picks : []
  const picks: RecommendPick[] = []
  const seenIds = new Set<string>()
  for (const p of rawPicks) {
    if (!isObj(p)) continue
    const repaired = repairPick(p)
    const src = (repaired ?? p) as Record<string, unknown>
    const reason = typeof src.reason === 'string' ? src.reason : ''
    const score = typeof src.score === 'number' ? src.score : 0
    const idRaw = typeof src.id === 'string' ? src.id : ''
    // id 优先；id 无效时用 name 回退
    let entry: IndexEntry | undefined = idRaw ? idToEntry.get(idRaw) : undefined
    if (!entry) {
      const nameRaw = typeof src.name === 'string' ? src.name : ''
      if (nameRaw) entry = nameToEntry.get(nameRaw)
    }
    if (!entry || seenIds.has(entry.id)) continue
    seenIds.add(entry.id)
    picks.push({ id: entry.id, name: entry.name, reason, score })
  }
  return { picks, dropped: rawPicks.length - picks.length }
}

// 推荐编排：retrieve -> buildPrompt -> llm -> parseJson -> 校验 id -> 响应。
export async function recommend(
  question: string,
  entries: IndexEntry[],
  enums: RestaurantEnums,
  llm: LlmClient,
  ctx?: TraceContext,
): Promise<RecommendResponse> {
  // 1. 规则检索候选集
  const { candidates } = retrieve(question, entries, enums)
  ctx?.event({ type: 'ai_retrieve', route: 'recommend', ok: true, detail: { candidates: candidates.length, questionChars: question.length } })

  // 2. 构建提示词
  const { system, user } = buildRecommendPrompt(question, candidates)

  // 3. 调 LLM
  const { text, model, usage } = await llm.run({ system, user })
  ctx?.event({ type: 'ai_llm', route: 'recommend', ok: true, detail: { model, promptChars: system.length + user.length, gateway: GATEWAY_ID, promptTokens: usage?.promptTokens } })

  // 4. 解析 JSON
  let parsed: LlmRecommendResult
  try {
    parsed = parseJsonResponse(text) as LlmRecommendResult
    ctx?.event({ type: 'ai_parse', route: 'recommend', ok: true, detail: { rawChars: text.length, ok: true } })
  } catch (e) {
    ctx?.event({ type: 'ai_parse', route: 'recommend', ok: false, detail: { rawChars: text.length, ok: false, error: e instanceof Error ? e.message : 'parse fail' } })
    throw e
  }

  // 5. 提取 answer
  const answer = typeof parsed.answer === 'string' ? parsed.answer : '推荐生成失败'

  // 6. 校验 picks：id 必须存在于候选集，否则丢弃
  const { picks, dropped } = validatePicks(parsed, candidates)
  ctx?.event({ type: 'ai_result', route: 'recommend', ok: true, detail: { picks: picks.length, dropped } })

  return {
    answer,
    picks,
    candidates_considered: candidates.length,
    model,
  }
}

// ===== 流式推荐 =====

// 流式事件：answer_chunk 实时推送 answer 增量；result 收尾推送完整结果（含已校验 picks）。
export type RecommendStreamEvent =
  | { type: 'answer_chunk'; data: { text: string } }
  | { type: 'result'; data: RecommendResponse }

// 解析 <answer>...</answer><picks>...</picks> 流式格式。
// 基于"累积全文 + 每次重新提取"实现：token 边界不对齐标签时也安全。
// feed 返回 answer 增量（仅新增长度）；收尾用 getAnswer / getPicksJson 取完整值。
export class StreamAnswerParser {
  private full = ''
  private sentAnswerLen = 0

  feed(token: string): string {
    this.full += token
    const answer = this.currentAnswer()
    if (answer.length > this.sentAnswerLen) {
      const delta = answer.slice(this.sentAnswerLen)
      this.sentAnswerLen = answer.length
      return delta
    }
    return ''
  }

  // 当前已确定的 answer 文本（去掉未闭合的尾标签前缀）
  private currentAnswer(): string {
    const start = this.full.indexOf('<answer>')
    if (start === -1) return ''
    const afterStart = start + 8
    const end = this.full.indexOf('</answer>', afterStart)
    if (end !== -1) return this.full.slice(afterStart, end)
    // answer 未闭合：取到 <picks> 前（若已开始 picks），否则取到尾部（去掉未完成标签）
    const picksStart = this.full.indexOf('<picks>', afterStart)
    if (picksStart !== -1) return this.full.slice(afterStart, picksStart)
    const tail = this.full.slice(afterStart)
    const lt = tail.lastIndexOf('<')
    if (lt !== -1 && tail.length - lt < 10) return tail.slice(0, lt) // 去掉可能的未闭合标签
    return tail
  }

  getAnswer(): string {
    return this.currentAnswer()
  }

  getPicksJson(): string {
    const start = this.full.indexOf('<picks>')
    if (start === -1) return ''
    const afterStart = start + 7
    const end = this.full.indexOf('</picks>', afterStart)
    return end !== -1 ? this.full.slice(afterStart, end).trim() : this.full.slice(afterStart).trim()
  }
}

// 流式推荐编排：流式 prompt 仅用于 answer 打字机显示；picks 用原 prompt 非流式调用保证质量。
// 实测 qwen 流式模式下 picks 极不稳定（空数组 / 畸形 JSON 交替），不可依赖流式 picks。
// 故拆为两次调用：①streamRun 流式 answer（打字机体验）②recommend 原 prompt 拿 picks（可靠）。
// 成本：两次 LLM 调用，对低频推荐可接受。无 streamRun 时降级为单次 recommend。
export async function* recommendStream(
  question: string,
  entries: IndexEntry[],
  enums: RestaurantEnums,
  llm: LlmClient,
  ctx?: TraceContext,
): AsyncGenerator<RecommendStreamEvent> {
  const { candidates } = retrieve(question, entries, enums)
  ctx?.event({
    type: 'ai_retrieve',
    route: 'recommend-stream',
    ok: true,
    detail: { candidates: candidates.length, questionChars: question.length },
  })

  // 降级：客户端无 streamRun 能力，单次 recommend
  if (!llm.streamRun) {
    ctx?.event({ type: 'ai_llm', route: 'recommend-stream', ok: true, detail: { model: MODEL, fallback: true } })
    const result = await recommend(question, entries, enums, llm, ctx)
    yield { type: 'answer_chunk', data: { text: result.answer } }
    yield { type: 'result', data: result }
    return
  }

  // ① 流式 answer：打字机体验
  const { system, user } = buildRecommendStreamPrompt(question, candidates)
  ctx?.event({
    type: 'ai_llm',
    route: 'recommend-stream',
    ok: true,
    detail: { model: MODEL, stream: true, gateway: GATEWAY_ID },
  })
  const stream = await llm.streamRun({ system, user })
  const parser = new StreamAnswerParser()
  const reader = stream.getReader()
  let streamAnswer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const delta = parser.feed(value)
      if (delta) {
        streamAnswer += delta
        yield { type: 'answer_chunk', data: { text: delta } }
      }
    }
  } finally {
    reader.releaseLock()
  }
  streamAnswer = parser.getAnswer() || streamAnswer

  // ② picks 用原 prompt 非流式调用（质量可靠）
  const result = await recommend(question, entries, enums, llm, ctx)
  yield {
    type: 'result',
    data: {
      answer: streamAnswer || result.answer,
      picks: result.picks,
      candidates_considered: result.candidates_considered,
      model: result.model,
    },
  }
}
