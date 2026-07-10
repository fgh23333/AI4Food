import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DataLoader } from './loader'
import { applyQuery, buildMeta, type QueryParams, type SortKey } from './query'
import type { LlmClient } from './ai/llm'
import { recommend } from './ai/recommend'
import { draft } from './ai/draft'
import { enumsFromEntries } from './ai/retrieve'
import { NOOP_TRACER, type Tracer } from './observability/tracer'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const VALID_SORTS: ReadonlySet<SortKey> = new Set(['name', 'rating', 'updated'])
const MAX_AI_INPUT = 500 // question/description 最大字数

// 允许的前端来源（GitHub Pages 线上 + 本地开发）
const ALLOWED_ORIGINS = new Set([
  'https://fgh23333.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

// 把字符串 query 解析为带校验的查询参数；非法值抛错（路由层转 400）。
function parseQuery(raw: {
  city?: string
  cuisine?: string
  price?: string
  status?: string
  q?: string
  tag?: string
  sort?: string
  limit?: string
  offset?: string
}): QueryParams & { sort: SortKey; limit: number; offset: number } {
  const params: QueryParams = {}
  if (raw.city) params.city = raw.city
  if (raw.cuisine) params.cuisine = raw.cuisine
  if (raw.status) params.status = raw.status
  if (raw.q) params.q = raw.q
  if (raw.tag) params.tag = raw.tag

  let price: number | undefined
  if (raw.price !== undefined && raw.price !== '') {
    price = Number(raw.price)
    if (!Number.isInteger(price) || price < 1 || price > 5) {
      throw new Error('price 必须是 1-5 的整数')
    }
    params.price = price
  }

  const sort: SortKey = raw.sort && VALID_SORTS.has(raw.sort as SortKey) ? (raw.sort as SortKey) : 'name'

  let limit = DEFAULT_LIMIT
  if (raw.limit !== undefined && raw.limit !== '') {
    limit = Number(raw.limit)
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('limit 必须是正整数')
    }
    limit = Math.min(limit, MAX_LIMIT)
  }

  let offset = 0
  if (raw.offset !== undefined && raw.offset !== '') {
    offset = Number(raw.offset)
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('offset 必须是非负整数')
    }
  }

  return { ...params, sort, limit, offset }
}

// CORS：仅放行白名单来源（避免被任意站点滥用 AI 接口产生费用）。
function corsOrigin(origin: string): string {
  return ALLOWED_ORIGINS.has(origin) ? origin : ''
}

export function createApp(loader: DataLoader, llm?: LlmClient, tracer: Tracer = NOOP_TRACER): Hono {
  const app = new Hono()

  app.use(
    '/api/*',
    cors({
      origin: (origin) => corsOrigin(origin ?? ''),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 86400,
    }),
  )

  // trace 中间件：记 http 事件（路由/方法/状态码/耗时/成败）。Tracer 内部已容错。
  app.use('/api/*', async (c, next) => {
    const ctx = tracer.begin(`${c.req.method} ${new URL(c.req.url).pathname}`, c.req.method)
    const start = ctx.start()
    await next()
    ctx.event({
      type: 'http',
      route: `${c.req.method} ${new URL(c.req.url).pathname}`,
      method: c.req.method,
      status: c.res.status,
      durationMs: ctx.elapsed(start),
      ok: c.res.status < 400,
    })
  })

  app.get('/api/restaurants', async (c) => {
    let parsed
    try {
      parsed = parseQuery(c.req.query())
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '参数错误' }, 400)
    }
    const all = await loader.loadAll()
    const { data, pagination } = applyQuery(all, parsed)
    return c.json({ data, pagination })
  })

  app.get('/api/restaurants/:id', async (c) => {
    const id = c.req.param('id')
    const all = await loader.loadAll()
    const found = all.find((r) => r.id === id)
    if (!found) return c.json({ error: 'not found' }, 404)
    return c.json(found)
  })

  app.get('/api/meta', async (c) => {
    const all = await loader.loadAll()
    return c.json(buildMeta(all))
  })

  // ===== 四期 AI 能力 =====

  app.post('/api/ai/recommend', async (c) => {
    if (!llm) return c.json({ error: 'AI 未配置（本地 Node 模式不支持 AI 路由）' }, 503)
    let body: { question?: unknown; city?: unknown }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: '请求体必须是 JSON' }, 400)
    }
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) return c.json({ error: 'question 必填' }, 400)
    if (question.length > MAX_AI_INPUT) {
      return c.json({ error: `question 不超过 ${MAX_AI_INPUT} 字` }, 400)
    }
    const all = await loader.loadAll()
    const enums = enumsFromEntries(all)
    const ctx = tracer.begin('POST /api/ai/recommend', 'POST')
    try {
      const result = await recommend(question, all, enums, llm, ctx)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI 推荐失败'
      // LLM 响应解析失败等 -> 502；其余 -> 500
      const status = msg.includes('JSON') || msg.includes('LLM') ? 502 : 500
      return c.json({ error: msg }, status)
    }
  })

  app.post('/api/ai/draft', async (c) => {
    if (!llm) return c.json({ error: 'AI 未配置（本地 Node 模式不支持 AI 路由）' }, 503)
    let body: { description?: unknown }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: '请求体必须是 JSON' }, 400)
    }
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (!description) return c.json({ error: 'description 必填' }, 400)
    if (description.length > MAX_AI_INPUT) {
      return c.json({ error: `description 不超过 ${MAX_AI_INPUT} 字` }, 400)
    }
    const all = await loader.loadAll()
    const enums = enumsFromEntries(all)
    const ctx = tracer.begin('POST /api/ai/draft', 'POST')
    try {
      const result = await draft(description, all, enums, llm, ctx)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI 草稿生成失败'
      const status = msg.includes('JSON') || msg.includes('LLM') ? 502 : 500
      return c.json({ error: msg }, status)
    }
  })

  return app
}
