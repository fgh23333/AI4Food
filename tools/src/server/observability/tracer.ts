// tools/src/server/observability/tracer.ts
// 全链路 trace：console.log（通道A，Workers Observability 自动采集）+ Analytics Engine（通道B，生产）。
// 业务只调 ctx.event(...)；Tracer 内部全 try/catch，绝不阻塞主请求。

export interface TraceRecord {
  type: string
  route: string
  method?: string
  status?: number
  durationMs?: number
  ok: boolean
  detail?: Record<string, unknown>
}

// Analytics Engine binding 的最小契约（避免引入 workers 全局类型）。
export interface AnalyticsDataset {
  writeDataPoint(p: { indexes: string[]; blobs: string[]; doubles: number[] }): void
}

export interface TraceContext {
  traceId: string
  event(record: Omit<TraceRecord, 'traceId'>): void
  start(): number
  elapsed(start: number): number
}

export interface Tracer {
  begin(route: string, method?: string): TraceContext
}

const MAX_DETAIL_BYTES = 15 * 1024 // 16KB blob 上限留余量

// 纯函数：record → Analytics dataPoint 字段映射。
export function mapRecordToDataPoint(record: TraceRecord & { traceId: string }): {
  indexes: string[]
  blobs: string[]
  doubles: number[]
} {
  const detailStr = truncate(JSON.stringify(record.detail ?? {}), MAX_DETAIL_BYTES)
  return {
    indexes: [record.traceId, record.type],
    blobs: [record.route, record.method ?? '', detailStr],
    doubles: [Date.now(), record.status ?? 0, record.durationMs ?? 0, record.ok ? 1 : 0],
  }
}

function truncate(s: string, maxBytes: number): string {
  // 两端兼容：用 TextEncoder/TextDecoder（Node 19+ 与 Worker 运行时都有）。
  // 不能用 Buffer--Worker 运行时无 Buffer。按 UTF-8 字节截断后 fatal:false decode，
  // 保证截断多字节字符中间时不抛、产出替换字符。
  const bytes = new TextEncoder().encode(s)
  if (bytes.length <= maxBytes) return s
  return new TextDecoder('utf8', { fatal: false }).decode(bytes.subarray(0, maxBytes))
}

function newTraceId(): string {
  // crypto.randomUUID 全平台可用（Node 19+ / Worker）。取前 8 位缩短。
  return (crypto as { randomUUID?: () => string }).randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)
}

export function createConsoleTracer(): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const traceId = newTraceId()
      const start = Date.now()
      return {
        traceId,
        start: () => start,
        elapsed: (s: number) => Date.now() - s,
        event(record) {
          try {
            console.log(JSON.stringify({ traceId, ...record }))
          } catch {
            // 静默
          }
        },
      }
    },
  }
}

export function createAnalyticsTracer(dataset: AnalyticsDataset, fallback: Tracer = createConsoleTracer()): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const ctx = fallback.begin(route, method)
      return {
        ...ctx,
        event(record) {
          ctx.event(record)
          try {
            dataset.writeDataPoint(mapRecordToDataPoint({ traceId: ctx.traceId, ...record }))
          } catch {
            // 静默
          }
        },
      }
    },
  }
}

// 组合 tracer：同一 event 广播给所有子 tracer，任一抛错不影响其他。
export function createDualTracer(tracers: Tracer[]): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const ctxs = tracers.map((t) => t.begin(route, method))
      const traceId = ctxs[0]?.traceId ?? newTraceId()
      return {
        traceId,
        start: () => ctxs[0]?.start() ?? Date.now(),
        elapsed: (s: number) => Date.now() - s,
        event(record) {
          for (const ctx of ctxs) {
            try {
              ctx.event(record)
            } catch {
              // 静默
            }
          }
        },
      }
    },
  }
}

export const NOOP_TRACER: Tracer = {
  begin(_route: string, _method?: string): TraceContext {
    const traceId = newTraceId()
    return {
      traceId,
      start: () => Date.now(),
      elapsed: (s: number) => Date.now() - s,
      event() {
        /* no-op */
      },
    }
  },
}