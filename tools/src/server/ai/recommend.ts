import type { IndexEntry, RestaurantEnums, RecommendResponse, RecommendPick } from '../../types'
import { retrieve } from './retrieve'
import { buildRecommendPrompt } from './prompt'
import { parseJsonResponse, type LlmClient } from './llm'

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
): Promise<RecommendResponse> {
  // 1. 规则检索候选集
  const { candidates } = retrieve(question, entries, enums)

  // 2. 构建提示词
  const { system, user } = buildRecommendPrompt(question, candidates)

  // 3. 调 LLM
  const { text, model } = await llm.run({ system, user })

  // 4. 解析 JSON
  const parsed = parseJsonResponse(text) as LlmRecommendResult

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

  return {
    answer,
    picks,
    candidates_considered: candidates.length,
    model,
  }
}
