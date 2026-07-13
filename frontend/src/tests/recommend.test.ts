import { describe, it, expect } from 'vitest'
import { dedupeChainPicks } from '@/lib/recommend'
import type { RecommendPick } from '@/types/ai'

const mk = (over: Partial<RecommendPick>): RecommendPick => ({ id: 'x', reason: 'r', score: 0.5, ...over })

describe('dedupeChainPicks', () => {
  it('同名（连锁）只留 score 最高', () => {
    const r = dedupeChainPicks([
      mk({ id: 'a', name: '海底捞', score: 0.7 }),
      mk({ id: 'b', name: '海底捞', score: 0.9 }),
      mk({ id: 'c', name: '西贝', score: 0.8 }),
    ])
    expect(r.map((p) => p.id)).toEqual(['b', 'c'])
  })
  it('无 name 的 pick 各自保留', () => {
    const r = dedupeChainPicks([mk({ id: 'a', name: undefined, score: 0.1 }), mk({ id: 'b', name: undefined, score: 0.9 })])
    expect(r).toHaveLength(2)
  })
  it('保持原顺序（首现优先，分数相同时）', () => {
    const r = dedupeChainPicks([mk({ id: 'a', name: 'X', score: 0.5 }), mk({ id: 'b', name: 'X', score: 0.5 })])
    expect(r.map((p) => p.id)).toEqual(['a'])
  })
})
