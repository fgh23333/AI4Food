import { describe, it, expect } from 'vitest'
import { appendProbe, healthRate, type ProbeEntry, type ProbeHistory } from '../../src/server/probe'

function mkEntry(ts: number, empty = false): ProbeEntry {
  return {
    ts,
    model: 'mock',
    queries: [
      { q: 'a', picks: empty ? 0 : 2, empty, ms: 100 },
      { q: 'b', picks: empty ? 0 : 1, empty, ms: 100 },
    ],
  }
}

describe('appendProbe', () => {
  it('空 history 首次追加', () => {
    const h = appendProbe(null, mkEntry(1))
    expect(h.entries).toHaveLength(1)
    expect(h.entries[0]?.ts).toBe(1)
  })

  it('按序追加多条', () => {
    let h = appendProbe(null, mkEntry(1))
    h = appendProbe(h, mkEntry(2))
    h = appendProbe(h, mkEntry(3))
    expect(h.entries.map((e) => e.ts)).toEqual([1, 2, 3])
  })

  it('超过 max 截断最旧（环形）', () => {
    let h: ProbeHistory = { entries: [] }
    for (let i = 0; i < 5; i++) h = appendProbe(h, mkEntry(i), 3)
    expect(h.entries).toHaveLength(3)
    expect(h.entries.map((e) => e.ts)).toEqual([2, 3, 4])
  })
})

describe('healthRate', () => {
  it('无历史返回 null', () => {
    expect(healthRate(null)).toBeNull()
    expect(healthRate({ entries: [] })).toBeNull()
  })

  it('最近一次全非空 -> 1', () => {
    const h = { entries: [mkEntry(1, false)] }
    expect(healthRate(h)).toBe(1)
  })

  it('最近一次全空 -> 0', () => {
    const h = { entries: [mkEntry(1, true)] }
    expect(healthRate(h)).toBe(0)
  })

  it('取最后一条（非历史平均）', () => {
    const h = { entries: [mkEntry(1, false), mkEntry(2, true)] }
    expect(healthRate(h)).toBe(0)
  })
})
