export interface RecommendationItem {
  name: string
  note?: string
}

export interface RestaurantFrontmatter {
  id: string
  name: string
  name_en?: string
  city: string
  country: string
  cuisine: string
  price_level: number
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  opening_hours?: Record<string, string>
  tags?: string[]
  rating?: number
  visited_date?: string
  recommendations?: RecommendationItem[]
  notes?: string
  photos?: string[]
  status: string
  verified?: boolean
  source?: string
  updated_at?: string
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  path: string
  message: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface RestaurantRecord {
  frontmatter: RestaurantFrontmatter
  body: string
  filePath: string
}

export interface RestaurantEnums {
  cuisines: string[]
  statuses: string[]
  priceLevels: number[]
}

// 索引条目：IndexEntry 的字段是前后端约定的数据契约。
// 定义在此纯类型文件，使 server/ 层 import 类型时不必拉入 indexer.ts（含 node:fs）。
// indexer.ts re-export 此接口作为对外导出。
export interface IndexEntry {
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
  // 展示用扩展字段（全部可选，缺失即 undefined）
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  opening_hours?: Record<string, string>
  recommendations?: RecommendationItem[]
  notes?: string
  description?: string
}
