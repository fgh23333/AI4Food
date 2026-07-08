import type { RestaurantEntry } from '@/types/restaurant'

export interface FilterState {
  query: string
  cuisine: string
  price: number
  onlyOpen: boolean
}

export function branchClosed(entry: RestaurantEntry): boolean {
  return (entry.status && entry.status !== 'open') || (entry.tags ?? []).includes('已关店')
}

export function filterRestaurants(all: RestaurantEntry[], s: FilterState): RestaurantEntry[] {
  const q = s.query.trim().toLowerCase()
  return all
    .filter((r) => !(s.onlyOpen && branchClosed(r)))
    .filter((r) => !(s.cuisine && r.cuisine !== s.cuisine))
    .filter((r) => !(s.price && r.price_level !== s.price))
    .filter((r) => {
      if (!q) return true
      const hay = [
        r.name, r.cuisine, r.address, r.notes, r.description,
        (r.tags ?? []).join(' '),
        (r.recommendations ?? []).map((x) => x.name).join(' '),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
}
