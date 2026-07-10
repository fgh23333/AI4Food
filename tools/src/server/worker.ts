/// <reference types="../../worker-configuration" />
import { createApp } from './hono'
import { createWorkerLoader } from './loader'
import { createWorkerLlm, type AiBinding } from './ai/llm'
import {
  createConsoleTracer, createAnalyticsTracer, createDualTracer, NOOP_TRACER,
  type Tracer, type AnalyticsDataset,
} from './observability/tracer'

// Cloudflare Workers 入口。env.ASSETS 是静态资源绑定（见 wrangler.jsonc），
// 指向仓库 dist/，运行时 fetch index.json 获取餐厅数据。
// env.AI 是 Workers AI 绑定（四期 AI 能力），经 AI Gateway eatornot 调用。

// 由 env 构造 tracer：有 ANALYTICS binding 走双通道，否则降级 console（本地）。
export function buildTracer(env: { ANALYTICS?: AnalyticsDataset }): Tracer {
  if (env.ANALYTICS) {
    return createDualTracer([createConsoleTracer(), createAnalyticsTracer(env.ANALYTICS, NOOP_TRACER)])
  }
  return createConsoleTracer()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // AI binding 仅在 wrangler.jsonc 配置了 ai binding 时存在；本地 Node 模式为 undefined，
    // 此时 createApp 不传 llm，AI 路由返回 503。
    const ai = (env as unknown as { AI?: AiBinding }).AI
    const analytics = (env as unknown as { ANALYTICS?: AnalyticsDataset }).ANALYTICS
    const llm = ai ? createWorkerLlm(ai) : undefined
    const tracer = buildTracer({ ANALYTICS: analytics })
    const app = createApp(createWorkerLoader(env.ASSETS), llm, tracer)
    return app.fetch(request)
  },
}
