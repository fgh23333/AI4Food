import type { RestaurantEntry, DisplayItem, ChainBrand } from '@/types/restaurant'
import { branchClosed } from './useFilter'

export function brandKey(entry: RestaurantEntry): string {
  return entry.id.split('-')[2] ?? entry.id
}

export { branchClosed }

export function branchLabel(entry: RestaurantEntry): string {
  let a = (entry.address ?? '').trim()
  if (a) {
    const stripped = a.replace(/^[^市]*市/, '').replace(/^[^区县]+[区县]/, '').trim()
    if (stripped) a = stripped
  }
  if (a) return a
  const tags = entry.tags ?? []
  return tags[tags.length - 1] ?? entry.name ?? entry.id
}

export function specialTag(entry: RestaurantEntry): string {
  const tags = entry.tags ?? []
  return tags.find((t) => ['首店', '旗舰店', '总店', '加盟店', '概念店'].includes(t)) ?? ''
}

export function averageRating(entries: RestaurantEntry[]): number | null {
  const rs = entries.map((e) => e.rating).filter((x): x is number => typeof x === 'number')
  if (rs.length === 0) return null
  return rs.reduce((a, b) => a + b, 0) / rs.length
}

export function toDisplayItems(list: RestaurantEntry[], mergeChains: boolean): DisplayItem[] {
  if (!mergeChains) {
    return list.map((entry) => ({ type: 'single', entry }))
  }
  // 计算每个 brand 的总数（基于全量？这里基于传入 list，调用方应传筛选后结果）
  const counts = new Map<string, number>()
  for (const e of list) counts.set(brandKey(e), (counts.get(brandKey(e)) ?? 0) + 1)

  const groups = new Map<string, RestaurantEntry[]>()
  const singles: DisplayItem[] = []
  for (const e of list) {
    const k = brandKey(e)
    if ((counts.get(k) ?? 0) >= 2) {
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(e)
    } else {
      singles.push({ type: 'single', entry: e })
    }
  }
  const chains: DisplayItem[] = []
  for (const [k, branches] of groups) {
    const first = branches[0]!
    const brand: ChainBrand = { key: k, name: first.name, cuisine: first.cuisine, branches }
    chains.push({ type: 'chain', brand })
  }
  return [...chains, ...singles]
}
