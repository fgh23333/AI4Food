import type { RestaurantEntry } from './restaurant'

export interface Pagination {
  total: number
  limit: number
  offset: number
  returned: number
}

export interface ListResponse {
  data: RestaurantEntry[]
  pagination: Pagination
}

export interface Meta {
  total: number
  open: number
  cities: string[]
  cuisines: string[]
  price_levels: number[]
}
