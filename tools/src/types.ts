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
