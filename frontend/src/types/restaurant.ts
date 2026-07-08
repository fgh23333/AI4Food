// ⚠️ 与 tools/src/indexer.ts 的 IndexEntry 保持一致；改字段需同步两侧。
// CI 脚本 scripts/check-schema.mjs 会校验索引 key 是本类型的子集。

export interface Recommendation {
  name: string
  note?: string
}

export interface RestaurantEntry {
  id: string
  name: string
  city: string
  country: string
  cuisine: string
  price_level: number
  status: string
  rating?: number
  tags?: string[]
  path: string
  updated_at?: string
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  opening_hours?: Record<string, string>
  recommendations?: Recommendation[]
  notes?: string
  description?: string
}

// 展示用联合类型：单店 | 连锁组（见 useChains）
export type ChainBrand = {
  key: string
  name: string
  cuisine: string
  branches: RestaurantEntry[]
}
export type DisplayItem =
  | { type: 'single'; entry: RestaurantEntry }
  | { type: 'chain'; brand: ChainBrand }
