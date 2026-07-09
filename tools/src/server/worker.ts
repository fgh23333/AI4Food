import { createApp } from './hono'
import { createWorkerLoader } from './loader'

// Cloudflare Workers 入口。env.ASSETS 是静态资源绑定（见 wrangler.jsonc），
// 指向仓库 dist/，运行时 fetch index.json 获取餐厅数据。
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp(createWorkerLoader(env.ASSETS))
    return app.fetch(request)
  },
}
