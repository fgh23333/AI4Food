import { createApp } from './hono'
import { createWorkerLoader } from './loader'
import { createWorkerLlm, type AiBinding } from './ai/llm'
import { buildTracer } from './tracer-builder'
import { type AnalyticsDataset } from './observability/tracer'

// Cloudflare Workers 入口。env.DATA_INDEX 是 KV 绑定（见 wrangler.jsonc），
// 运行时从 KV 读取 index.json；数据与运行时解耦，数据更新无需重部署。
// env.ASSETS 保留用于前端 SPA 静态资源。
// env.AI 是 Workers AI 绑定（四期 AI 能力），经 AI Gateway eatornot 调用。

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // AI binding 仅在 wrangler.jsonc 配置了 ai binding 时存在；本地 Node 模式为 undefined，
    // 此时 createApp 不传 llm，AI 路由返回 503。
    const ai = (env as unknown as { AI?: AiBinding }).AI
    const analytics = (env as unknown as { ANALYTICS?: AnalyticsDataset }).ANALYTICS
    const llm = ai ? createWorkerLlm(ai) : undefined
    const tracer = buildTracer({ ANALYTICS: analytics })
    const app = createApp(createWorkerLoader(env.DATA_INDEX), llm, tracer)
    return app.fetch(request)
  },
}
