import type { IndexEntry, RestaurantEnums } from '../../types'

// 候选集精简摘要：只保留 LLM 选餐厅需要的字段，剔除冗长/敏感字段。
export interface CandidateSummary {
  id: string
  name: string
  cuisine: string
  price_level: number
  rating?: number
  tags?: string[]
  address?: string
  notes?: string
}

export function summarizeCandidate(e: IndexEntry): CandidateSummary {
  return {
    id: e.id,
    name: e.name,
    cuisine: e.cuisine,
    price_level: e.price_level,
    ...(e.rating !== undefined ? { rating: e.rating } : {}),
    ...(e.tags ? { tags: e.tags } : {}),
    ...(e.address ? { address: e.address } : {}),
    ...(e.notes ? { notes: e.notes } : {}),
  }
}

// 推荐提示词：约束 LLM 只能从候选集选、输出结构化 JSON。
export function buildRecommendPrompt(
  question: string,
  candidates: IndexEntry[],
): { system: string; user: string } {
  const system = `你是 AI4Food 美食推荐助手。你只能从用户提供的候选餐厅列表中选择，禁止编造不在候选集里的餐厅。
请根据用户的提问，从候选餐厅里挑选最符合的 1-3 家，并给出推荐理由。

输出必须是合法 JSON，格式如下，不要输出 JSON 以外的任何文字：
{
  "answer": "一句话总结性回答",
  "picks": [
    { "id": "候选餐厅id", "reason": "推荐理由", "score": 0.0到1.0的相关度 }
  ]
}

规则：
- picks 里的 id 必须来自候选餐厅列表，不得编造。
- 若候选集为空，返回 {"answer": "暂时没有匹配的餐厅", "picks": []}。
- score 为 0-1 的浮点数，表示与提问的相关度。
- reason 简明扼要，结合提问的需求（价位、菜系、场景、位置等）。`

  const list = candidates.length > 0
    ? JSON.stringify(candidates.map(summarizeCandidate))
    : '（无候选餐厅）'

  const user = `候选餐厅列表（JSON）：
${list}

用户提问：${question}`

  return { system, user }
}

// 辅助贡献提示词：要求 LLM 输出符合 schema 的 frontmatter 草稿 JSON。
export function buildDraftPrompt(
  description: string,
  enums: RestaurantEnums,
): { system: string; user: string } {
  const system = `你是 AI4Food 餐厅数据助手。根据用户对一家餐厅的自然语言描述，生成符合数据规范的餐厅草稿（JSON）。

字段规范：
- name: 餐厅名称（必填）
- cuisine: 菜系，只能从这些值里选：${enums.cuisines.join('、')}
- price_level: 价位 1-5 整数（1 最便宜，5 最贵）（必填）
- status: 营业状态，只能选：${enums.statuses.join('、')}
- city: 城市
- country: 国家代码（如 cn）
- address: 地址（描述里有的话填）
- tags: 标签数组
- phone: 电话（描述里有的话填）
- notes: 简短备注
- description: markdown 格式的探店正文草稿（# 标题 + 一段描述）

输出必须是合法 JSON 对象，只包含上述字段，不要输出 JSON 以外的文字。
描述里没提到的字段不要编造，可以省略（name/cuisine/price_level/status 必填，缺失时给合理默认值）。`

  const user = `用户对餐厅的描述：${description}

请生成餐厅草稿 JSON。`

  return { system, user }
}
