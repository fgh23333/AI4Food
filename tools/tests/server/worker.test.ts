import { describe, it, expect } from 'vitest'
import { buildTracer } from '../../src/server/worker'

describe('buildTracer', () => {
  it('无 ANALYTICS binding 时返回 console tracer（非 dual），调一次不抛', () => {
    const t = buildTracer({})
    expect(t).toBeDefined()
    expect(() => t.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
  })
  it('有 ANALYTICS binding 时返回 tracer 且 writeDataPoint 抛错也不影响', () => {
    const bad = { writeDataPoint() { throw new Error('x') } }
    const t = buildTracer({ ANALYTICS: bad })
    expect(() => t.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
  })
})
