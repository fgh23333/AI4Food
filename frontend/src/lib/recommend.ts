import type { RecommendPick } from '@/types/ai'

export function dedupeChainPicks(picks: RecommendPick[]): RecommendPick[] {
  const seen = new Map<string, RecommendPick>()
  const result: RecommendPick[] = []

  for (const p of picks) {
    const key = p.name?.trim()
    if (!key) {
      result.push(p)
      continue
    }

    const prev = seen.get(key)
    if (!prev) {
      seen.set(key, p)
      result.push(p)
    } else if ((p.score ?? 0) > (prev.score ?? 0)) {
      const idx = result.indexOf(prev)
      result[idx] = p
      seen.set(key, p)
    }
  }

  return result
}
