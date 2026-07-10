// tools/tests/server/observability/tracer.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  mapRecordToDataPoint,
  createConsoleTracer,
  createAnalyticsTracer,
  createDualTracer,
  NOOP_TRACER,
  type TraceRecord,
  type Tracer,
  type AnalyticsDataset,
} from '../../../src/server/observability/tracer'

describe('mapRecordToDataPoint', () => {
  const base = (over: Partial<TraceRecord> = {}): TraceRecord & { traceId: string } => ({
    traceId: 'abcd1234',
    type: 'http',
    route: 'GET /api/meta',
    ok: true,
    ...over,
  })

  it('完整字段映射到 indexes/blobs/doubles', () => {
    const dp = mapRecordToDataPoint(base({ method: 'GET', status: 200, durationMs: 12, detail: { x: 1 } }))
    expect(dp.indexes).toEqual(['abcd1234', 'http'])
    expect(dp.blobs[0]).toBe('GET /api/meta')
    expect(dp.blobs[1]).toBe('GET')
    expect(dp.blobs[2]).toBe('{"x":1}')
    expect(dp.doubles[1]).toBe(200)
    expect(dp.doubles[2]).toBe(12)
    expect(dp.doubles[3]).toBe(1)
  })

  it('缺省 method/status/durationMs 时用空/0 兜底', () => {
    const dp = mapRecordToDataPoint(base({}))
    expect(dp.blobs[1]).toBe('')
    expect(dp.doubles[1]).toBe(0)
    expect(dp.doubles[2]).toBe(0)
  })

  it('detail 缺失时 blobs[2] 为 "{}"', () => {
    const dp = mapRecordToDataPoint(base({ detail: undefined }))
    expect(dp.blobs[2]).toBe('{}')
  })

  it('detail 超大时截断到 15KB', () => {
    const big = { x: '字'.repeat(20000) }
    const dp = mapRecordToDataPoint(base({ detail: big }))
    expect(dp.blobs[2]!.length).toBeLessThanOrEqual(15360)
  })
})

describe('createConsoleTracer', () => {
  it('event 打印含 traceId 与 type 的 JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ctx = createConsoleTracer().begin('GET /api/meta', 'GET')
    ctx.event({ type: 'http', route: 'GET /api/meta', ok: true })
    expect(JSON.parse(spy.mock.calls[0]![0] as string).type).toBe('http')
    expect(JSON.parse(spy.mock.calls[0]![0] as string).traceId).toBe(ctx.traceId)
    spy.mockRestore()
  })
})

describe('createAnalyticsTracer', () => {
  it('binding 缺失时降级到 fallback（console）且不抛', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const bad: AnalyticsDataset = { writeDataPoint() { throw new Error('boom') } }
    const ctx = createAnalyticsTracer(bad).begin('r', 'POST')
    expect(() => ctx.event({ type: 'ai_llm', route: 'r', ok: true })).not.toThrow()
    spy.mockRestore()
  })

  it('正常时 console + writeDataPoint 双发', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const dataset: AnalyticsDataset = { writeDataPoint: vi.fn() }
    const ctx = createAnalyticsTracer(dataset, NOOP_TRACER).begin('r', 'POST')
    ctx.event({ type: 'ai_llm', route: 'r', ok: true, detail: { model: 'm' } })
    expect(spy).not.toHaveBeenCalled() // fallback 是 NOOP，故无 console
    expect((dataset.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('createDualTracer', () => {
  it('广播给所有子 tracer，一个抛不影响其他', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = { writeDataPoint: vi.fn() } as unknown as AnalyticsDataset
    const t1 = createAnalyticsTracer(ok)
    const boom = { writeDataPoint: vi.fn(() => { throw new Error('x') }) } as unknown as AnalyticsDataset
    const t2 = createAnalyticsTracer(boom)
    const dual = createDualTracer([t1, t2])
    expect(() => dual.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
    expect((ok.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('一个子 tracer begin() 抛错时，begin() 不抛且幸存子 tracer 仍收到 event()', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const good: Tracer = {
      begin: vi.fn((route: string, method?: string) => createConsoleTracer().begin(route, method)),
    }
    const bad: Tracer = {
      begin: vi.fn(() => { throw new Error('begin boom') }),
    }
    const dual = createDualTracer([good, bad])
    const ctx = dual.begin('GET /x', 'GET')
    expect(() => ctx.event({ type: 'http', route: 'GET /x', ok: true })).not.toThrow()
    // 幸存子 tracer 的 event 被调用（console.log 有输出）
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('所有子 tracer begin() 都抛错时，begin() 仍返回可用 ctx 且 event() 不抛', () => {
    const bad1: Tracer = {
      begin: vi.fn(() => { throw new Error('boom1') }),
    }
    const bad2: Tracer = {
      begin: vi.fn(() => { throw new Error('boom2') }),
    }
    const dual = createDualTracer([bad1, bad2])
    const ctx = dual.begin('GET /x', 'GET')
    expect(ctx).toBeDefined()
    expect(ctx.traceId).toBeTruthy()
    expect(() => ctx.event({ type: 'http', route: 'GET /x', ok: true })).not.toThrow()
  })
})

describe('createAnalyticsTracer begin() 防御', () => {
  it('fallback begin() 抛错时，begin() 不抛且返回可用 ctx', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const fallback: Tracer = {
      begin: vi.fn(() => { throw new Error('fallback begin boom') }),
    }
    const dataset: AnalyticsDataset = { writeDataPoint: vi.fn() }
    const tracer = createAnalyticsTracer(dataset, fallback)
    const ctx = tracer.begin('GET /x', 'GET')
    expect(ctx).toBeDefined()
    expect(ctx.traceId).toBeTruthy()
    expect(() => ctx.event({ type: 'http', route: 'GET /x', ok: true })).not.toThrow()
    spy.mockRestore()
  })
})
