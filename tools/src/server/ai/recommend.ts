import type { IndexEntry, RestaurantEnums, RecommendResponse, RecommendPick } from '../../types'
import { retrieve } from './retrieve'
import { buildRecommendPrompt } from './prompt'
import { parseJsonResponse, type LlmClient, GATEWAY_ID } from './llm'
import type { TraceContext } from '../observability/tracer'

// LLM 单次返回的原始结构（picks 的 id 可能不存在于候选集，需校验）
interface LlmRecommendResult {
  answer?: unknown
  picks?: unknown
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
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
  const candidateIds = new Set(candidates.map((c) => c.id))
  const idToEntry = new Map(candidates.map((c) => [c.id, c]))
  const rawPicks = Array.isArray(parsed.picks) ? parsed.picks : []
  const picks: RecommendPick[] = []
  for (const p of rawPicks) {
    if (!isObj(p)) continue
    const id = typeof p.id === 'string' ? p.id : ''
    if (!id || !candidateIds.has(id)) continue // 丢弃不存在的 id（防幻觉）
    const reason = typeof p.reason === 'string' ? p.reason : ''
    const score = typeof p.score === 'number' ? p.score : 0
    const entry = idToEntry.get(id)
    picks.push({ id, name: entry?.name, reason, score })
  }
  const dropped = rawPicks.length - picks.length
  ctx?.event({ type: 'ai_result', route: 'recommend', ok: true, detail: { picks: picks.length, dropped } })

  return {
    answer,
    picks,
    candidates_considered: candidates.length,
    model,
  }
}
