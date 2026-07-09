import { createApp } from './hono'
import { createWorkerLoader } from './loader'
import { createWorkerLlm, type AiBinding } from './ai/llm'

// Cloudflare Workers 入口。env.ASSETS 是静态资源绑定（见 wrangler.jsonc），
// 指向仓库 dist/，运行时 fetch index.json 获取餐厅数据。
// env.AI 是 Workers AI 绑定（四期 AI 能力），经 AI Gateway eatornot 调用。
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // AI binding 仅在 wrangler.jsonc 配置了 ai binding 时存在；本地 Node 模式为 undefined，
    // 此时 createApp 不传 llm，AI 路由返回 503。
    const ai = (env as unknown as { AI?: AiBinding }).AI
    const llm = ai ? createWorkerLlm(ai) : undefined
    const app = createApp(createWorkerLoader(env.ASSETS), llm)
    return app.fetch(request)
  },
}
