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

// 校验 picks：id 必须存在于候选集，否则丢弃（防幻觉）。recommend 与 recommendStream 共用。
function validatePicks(
  parsed: LlmRecommendResult,
  candidates: IndexEntry[],
): { picks: RecommendPick[]; dropped: number } {
  const candidateIds = new Set(candidates.map((c) => c.id))
  const idToEntry = new Map(candidates.map((c) => [c.id, c]))
  const rawPicks = Array.isArray(parsed.picks) ? parsed.picks : []
  const picks: RecommendPick[] = []
  for (const p of rawPicks) {
    if (!isObj(p)) continue
    const id = typeof p.id === 'string' ? p.id : ''
    if (!id || !candidateIds.has(id)) continue
    const reason = typeof p.reason === 'string' ? p.reason : ''
    const score = typeof p.score === 'number' ? p.score : 0
    const entry = idToEntry.get(id)
    picks.push({ id, name: entry?.name, reason, score })
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

// 流式推荐编排：retrieve -> streamPrompt -> llm.streamRun -> 状态机解析 answer 增量 -> 收尾校验 picks。
// 无 streamRun 能力时降级为一次性 recommend（仍发 answer_chunk + result 两个事件）。
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

  const { system, user } = buildRecommendStreamPrompt(question, candidates)

  // 降级：客户端无 streamRun
  if (!llm.streamRun) {
    ctx?.event({ type: 'ai_llm', route: 'recommend-stream', ok: true, detail: { model: MODEL, fallback: true } })
    const result = await recommend(question, entries, enums, llm, ctx)
    yield { type: 'answer_chunk', data: { text: result.answer } }
    yield { type: 'result', data: result }
    return
  }

  const stream = await llm.streamRun({ system, user })
  ctx?.event({
    type: 'ai_llm',
    route: 'recommend-stream',
    ok: true,
    detail: { model: MODEL, stream: true, gateway: GATEWAY_ID },
  })

  const parser = new StreamAnswerParser()
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const delta = parser.feed(value)
      if (delta) yield { type: 'answer_chunk', data: { text: delta } }
    }
  } finally {
    reader.releaseLock()
  }

  const answer = parser.getAnswer() || '推荐生成失败'
  const picksJson = parser.getPicksJson()

  let picks: RecommendPick[] = []
  let dropped = 0
  try {
    const parsed = parseJsonResponse(picksJson) as LlmRecommendResult
    const v = validatePicks(parsed, candidates)
    picks = v.picks
    dropped = v.dropped
    ctx?.event({ type: 'ai_parse', route: 'recommend-stream', ok: true, detail: { ok: true, picks: picks.length, dropped } })
  } catch (e) {
    ctx?.event({
      type: 'ai_parse',
      route: 'recommend-stream',
      ok: false,
      detail: { ok: false, error: e instanceof Error ? e.message : 'parse fail' },
    })
  }
  ctx?.event({ type: 'ai_result', route: 'recommend-stream', ok: true, detail: { picks: picks.length, dropped } })

  yield {
    type: 'result',
    data: { answer, picks, candidates_considered: candidates.length, model: MODEL },
  }
}
