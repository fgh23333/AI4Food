import { Hono } from 'hono'
import type { DataLoader } from './loader'
import { applyQuery, buildMeta, type QueryParams, type SortKey } from './query'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const VALID_SORTS: ReadonlySet<SortKey> = new Set(['name', 'rating', 'updated'])

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

export function createApp(loader: DataLoader): Hono {
  const app = new Hono()

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

  // 预留：下一期接入 LLM
  // app.post('/api/ai/recommend', ...)

  return app
}
