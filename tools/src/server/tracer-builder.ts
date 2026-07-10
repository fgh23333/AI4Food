import {
  createConsoleTracer, createAnalyticsTracer, createDualTracer, NOOP_TRACER,
  type Tracer, type AnalyticsDataset,
} from './observability/tracer'

// 由 env 构造 tracer：有 ANALYTICS binding 走双通道，否则降级 console（本地）。
export function buildTracer(env: { ANALYTICS?: AnalyticsDataset }): Tracer {
  if (env.ANALYTICS) {
    return createDualTracer([createConsoleTracer(), createAnalyticsTracer(env.ANALYTICS, NOOP_TRACER)])
  }
  return createConsoleTracer()
}
