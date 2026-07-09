import type { IndexEntry, RestaurantEnums } from '../../types'
import { filterBy, type QueryParams } from '../query'

// 塞进 LLM prompt 的候选集上限：超过则截断，避免 prompt 过长。
export const MAX_CANDIDATES = 30

// 从自然语言提问中抽取结构化筛选参数。
// - 城市：匹配已知城市集合（entries 出现过的 city 值，精确）
// - 菜系：匹配 enums.cuisines 枚举值（精确）
// - 价位：暂不抽取（中文价位表述歧义大，留给 LLM 在候选集里判断）
// - 其余文本作为模糊关键词 q（匹配 name/tags/address）
// 多个匹配取第一个出现位置；抽取过的子串从 q 中剔除，避免重复过滤。
export function extractParams(
  question: string,
  enums: RestaurantEnums,
  knownCities: string[] = [],
): QueryParams {
  const params: QueryParams = {}
  // 记录被消费的子串区间，用于生成 q
  let remaining = question

  // 城市：优先用 knownCities，否则用 enums 里没有的城市信息——这里只用 knownCities
  if (knownCities.length > 0) {
    const hit = knownCities.find((c) => c && question.includes(c))
    if (hit) {
      params.city = hit
      remaining = remaining.replace(hit, ' ')
    }
  }

  // 菜系：找提问里出现的枚举值
  const cuisHit = enums.cuisines.find((c) => c && question.includes(c))
  if (cuisHit) {
    params.cuisine = cuisHit
    remaining = remaining.replace(cuisHit, ' ')
  }

  // 剩余文本作为关键词（去城市/菜系后）；中文需保留有意义的片段
  const q = remaining.replace(/\s+/g, ' ').trim()
  if (q) params.q = q

  return params
}

// 从 entries 推导已知城市集合（去重）。
export function knownCitiesFrom(entries: IndexEntry[]): string[] {
  return [...new Set(entries.map((e) => e.city))]
}

// 从 entries 推导枚举集合（与二期 buildMeta 一致的推导逻辑）。
// Worker 端无 fs 读 schema/enums.json，故从数据推导；retrieve/draft 共用。
export function enumsFromEntries(entries: IndexEntry[]): RestaurantEnums {
  const cuisines = new Set<string>()
  const statuses = new Set<string>()
  const prices = new Set<number>()
  for (const e of entries) {
    cuisines.add(e.cuisine)
    statuses.add(e.status)
    prices.add(e.price_level)
  }
  return {
    cuisines: [...cuisines],
    statuses: [...statuses],
    priceLevels: [...prices].sort((a, b) => a - b),
  }
}

// 规则检索：抽参数 -> filterBy -> 空集逐级放宽 -> 按 rating 降序 -> 截断。
// 放宽顺序：先去 q（最弱信号），再去 cuisine，最后去 city。
export function retrieve(
  question: string,
  entries: IndexEntry[],
  enums: RestaurantEnums,
): { candidates: IndexEntry[]; params: QueryParams } {
  const cities = knownCitiesFrom(entries)
  const base = extractParams(question, enums, cities)

  // 依次尝试：完整 -> 去 q -> 去 cuisine -> 去 city -> 全部
  const relaxSteps: QueryParams[] = [
    base,
    { city: base.city, cuisine: base.cuisine },
    { city: base.city },
    {},
  ]

  let filtered: IndexEntry[] = []
  let usedParams: QueryParams = {}
  for (const p of relaxSteps) {
    const result = filterBy(entries, p)
    if (result.length > 0) {
      filtered = result
      usedParams = p
      break
    }
  }

  // 按 rating 降序（缺失排后），让 LLM 优先看到高分店
  const sorted = [...filtered].sort((a, b) => {
    const ar = a.rating ?? 0
    const br = b.rating ?? 0
    return br - ar
  })

  const candidates = sorted.slice(0, MAX_CANDIDATES)
  return { candidates, params: usedParams }
}
