import type { IndexEntry } from '../types'

// 查询参数：所有维度可选，未传 = 不过滤
export interface QueryParams {
  city?: string
  cuisine?: string
  price?: number
  status?: string
  q?: string
  tag?: string
}

export type SortKey = 'name' | 'rating' | 'updated'

export interface Pagination {
  total: number
  limit: number
  offset: number
  returned: number
}

export interface PaginatedResult {
  data: IndexEntry[]
  pagination: Pagination
}

export interface Meta {
  total: number
  open: number
  cities: string[]
  cuisines: string[]
  price_levels: number[]
}

const collator = new Intl.Collator('zh')

// 按 city/cuisine/price/status/tag/q 过滤。条件间为 AND。
export function filterBy(entries: IndexEntry[], params: QueryParams): IndexEntry[] {
  const q = params.q?.trim().toLowerCase()
  return entries.filter((e) => {
    if (params.city !== undefined && e.city !== params.city) return false
    if (params.cuisine !== undefined && e.cuisine !== params.cuisine) return false
    if (params.price !== undefined && e.price_level !== params.price) return false
    if (params.status !== undefined && e.status !== params.status) return false
    if (params.tag !== undefined && !(e.tags ?? []).includes(params.tag)) return false
    if (q !== undefined && q !== '') {
      const hay = [e.name, e.address ?? '', e.cuisine, ...(e.tags ?? [])]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// 排序：name 升序（zh）；rating/updated 降序，缺失值排末尾。返回新数组。
export function sortBy(entries: IndexEntry[], key: SortKey): IndexEntry[] {
  const copy = [...entries]
  if (key === 'name') {
    copy.sort((a, b) => collator.compare(a.name, b.name))
    return copy
  }
  // rating/updated 降序，缺失（undefined/空）排末尾
  copy.sort((a, b) => {
    const av = key === 'rating' ? a.rating : a.updated_at
    const bv = key === 'rating' ? b.rating : b.updated_at
    const aMissing = av === undefined || av === ''
    const bMissing = bv === undefined || bv === ''
    if (aMissing && bMissing) return 0
    if (aMissing) return 1 // a 缺失排后
    if (bMissing) return -1
    return bv! < av! ? -1 : bv! > av! ? 1 : 0 // 降序
  })
  return copy
}

// 分页。limit/offset 已由调用方规范化（>=0）。
export function paginate(entries: IndexEntry[], limit: number, offset: number): PaginatedResult {
  const total = entries.length
  const data = entries.slice(offset, offset + limit)
  return {
    data,
    pagination: { total, limit, offset, returned: data.length },
  }
}

// 汇总元数据。
export function buildMeta(entries: IndexEntry[]): Meta {
  const cities = new Set<string>()
  const cuisines = new Set<string>()
  const prices = new Set<number>()
  let open = 0
  for (const e of entries) {
    cities.add(e.city)
    cuisines.add(e.cuisine)
    prices.add(e.price_level)
    if (e.status === 'open') open += 1
  }
  return {
    total: entries.length,
    open,
    cities: [...cities],
    cuisines: [...cuisines],
    price_levels: [...prices],
  }
}

// 组合入口：过滤 → 排序 → 分页。
export function applyQuery(
  entries: IndexEntry[],
  params: QueryParams & { sort?: SortKey; limit?: number; offset?: number },
): PaginatedResult {
  const filtered = filterBy(entries, params)
  const sorted = sortBy(filtered, params.sort ?? 'name')
  return paginate(sorted, params.limit ?? 50, params.offset ?? 0)
}
