import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/hono'
import type { DataLoader } from '../../src/server/loader'
import type { LlmClient, LlmInput, LlmOutput } from '../../src/server/ai/llm'
import type { IndexEntry } from '../../src/indexer'
import { NOOP_TRACER, type Tracer, type TraceRecord } from '../../src/server/observability/tracer'

function recordingTracer(): { tracer: Tracer; events: (TraceRecord & { traceId: string })[] } {
  const events: (TraceRecord & { traceId: string })[] = []
  const tracer: Tracer = {
    begin(route: string, method?: string) {
      const ctx = NOOP_TRACER.begin(route, method)
      return {
        ...ctx,
        event(record) { events.push({ traceId: ctx.traceId, ...record }) },
      }
    },
  }
  return { tracer, events }
}

// 内存假 loader，注入固定数据
function fakeLoader(entries: IndexEntry[]): DataLoader {
  return { async loadAll() { return entries } }
}

// mock LLM 客户端，返回固定文本
function fakeLlm(text: string): LlmClient {
  return {
    async run(_input: LlmInput): Promise<LlmOutput> {
      return { text, model: 'mock' }
    },
  }
}

// 类型化读取 JSON body（res.json() 默认返回 unknown）
interface ListBody {
  data: IndexEntry[]
  pagination: { total: number; limit: number; offset: number; returned: number }
}
interface MetaBody {
  total: number
  open: number
  cities: string[]
  cuisines: string[]
  price_levels: number[]
}
interface ErrorBody {
  error: string
}
interface DetailBody extends IndexEntry {}
async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

const entries: IndexEntry[] = [
  {
    id: 'cn-shanghai-a',
    name: '阿强饭店',
    city: '上海',
    country: 'cn',
    cuisine: '本帮菜',
    price_level: 2,
    status: 'open',
    rating: 4.5,
    tags: ['本帮'],
    address: '南京东路',
    path: 'data/a.md',
    updated_at: '2026-07-08',
  },
  {
    id: 'cn-shanghai-b',
    name: 'Bistro B',
    city: '上海',
    country: 'cn',
    cuisine: '西餐',
    price_level: 4,
    status: 'closed',
    rating: 4.0,
    tags: ['西餐'],
    address: '淮海路',
    path: 'data/b.md',
    updated_at: '2026-07-01',
  },
]

describe('GET /api/restaurants', () => {
  it('默认返回全部 + 分页元信息', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants')
    expect(res.status).toBe(200)
    const body = await jsonBody<ListBody>(res)
    expect(body.data.length).toBe(2)
    expect(body.pagination).toEqual({ total: 2, limit: 50, offset: 0, returned: 2 })
  })

  it('按 cuisine 筛选', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants?cuisine=西餐')
    const body = await jsonBody<ListBody>(res)
    expect(body.data.map((e) => e.id)).toEqual(['cn-shanghai-b'])
  })

  it('按 status 筛选', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants?status=closed')
    const body = await jsonBody<ListBody>(res)
    expect(body.data.map((e) => e.id)).toEqual(['cn-shanghai-b'])
  })

  it('limit/offset 分页', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants?limit=1&offset=1')
    const body = await jsonBody<ListBody>(res)
    expect(body.data.length).toBe(1)
    expect(body.pagination.offset).toBe(1)
    expect(body.pagination.returned).toBe(1)
  })

  it('非法 price 返回 400', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants?price=abc')
    expect(res.status).toBe(400)
    const body = await jsonBody<ErrorBody>(res)
    expect(body.error).toBeTruthy()
  })

  it('price 越界返回 400', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants?price=9')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/restaurants/:id', () => {
  it('命中返回 200 单条', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants/cn-shanghai-a')
    expect(res.status).toBe(200)
    const body = await jsonBody<DetailBody>(res)
    expect(body.id).toBe('cn-shanghai-a')
  })

  it('未命中返回 404', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/restaurants/nope')
    expect(res.status).toBe(404)
    const body = await jsonBody<ErrorBody>(res)
    expect(body.error).toBeTruthy()
  })
})

describe('GET /api/meta', () => {
  it('返回汇总元数据', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
    const body = await jsonBody<MetaBody>(res)
    expect(body.total).toBe(2)
    expect(body.open).toBe(1)
    expect(body.cuisines.sort()).toEqual(['本帮菜', '西餐'])
  })
})

// ===== 四期 AI 路由 =====

interface RecommendBody {
  answer: string
  picks: { id: string; reason: string; score: number }[]
  candidates_considered: number
  model: string
}
interface DraftBody {
  draft: { name: string; cuisine: string; price_level: number; status: string }
  warnings: string[]
  model: string
}

describe('POST /api/ai/recommend', () => {
  it('正常返回推荐', async () => {
    const llmText = JSON.stringify({
      answer: '推荐阿强',
      picks: [{ id: 'cn-shanghai-a', reason: '本帮菜', score: 0.9 }],
    })
    const app = createApp(fakeLoader(entries), fakeLlm(llmText))
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '上海本帮菜' }),
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<RecommendBody>(res)
    expect(body.answer).toBe('推荐阿强')
    expect(body.picks[0]?.id).toBe('cn-shanghai-a')
  })

  it('question 缺失返回 400', async () => {
    const app = createApp(fakeLoader(entries), fakeLlm('{}'))
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('question 超长返回 400', async () => {
    const app = createApp(fakeLoader(entries), fakeLlm('{}'))
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'x'.repeat(501) }),
    })
    expect(res.status).toBe(400)
  })

  it('LLM 非法 JSON 返回 502', async () => {
    const app = createApp(fakeLoader(entries), fakeLlm('乱文本'))
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '上海菜' }),
    })
    expect(res.status).toBe(502)
  })

  it('未配置 LLM 返回 503', async () => {
    const app = createApp(fakeLoader(entries)) // 不传 llm
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '上海菜' }),
    })
    expect(res.status).toBe(503)
  })
})

describe('POST /api/ai/draft', () => {
  it('正常返回草稿', async () => {
    const llmText = JSON.stringify({
      name: '新店', cuisine: '本帮菜', price_level: 3, status: 'open',
    })
    const app = createApp(fakeLoader(entries), fakeLlm(llmText))
    const res = await app.request('/api/ai/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: '一家本帮菜' }),
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<DraftBody>(res)
    expect(body.draft.name).toBe('新店')
  })

  it('description 缺失返回 400', async () => {
    const app = createApp(fakeLoader(entries), fakeLlm('{}'))
    const res = await app.request('/api/ai/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('CORS', () => {
  it('白名单来源返回 Access-Control-Allow-Origin', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/meta', {
      headers: { origin: 'https://fgh23333.github.io' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://fgh23333.github.io')
  })

  it('非白名单来源不返回 ACAO', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/meta', {
      headers: { origin: 'https://evil.example.com' },
    })
    // Hono cors 对不匹配 origin 不加该头，get 返回 null
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('hono trace（http 事件）', () => {
  it('GET /api/meta 触发 http 事件，status 200，ok true', async () => {
    const { tracer, events } = recordingTracer()
    const app = createApp(fakeLoader(entries), undefined, tracer)
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
    const http = events.find((e) => e.type === 'http')
    expect(http).toBeDefined()
    expect(http!.status).toBe(200)
    expect(http!.ok).toBe(true)
    expect(http!.route).toBe('GET /api/meta')
  })

  it('非法参数返回 400 且记 ok false', async () => {
    const { tracer, events } = recordingTracer()
    const app = createApp(fakeLoader(entries), undefined, tracer)
    await app.request('/api/restaurants?price=9')
    const http = events.find((e) => e.type === 'http')!
    expect(http.status).toBe(400)
    expect(http.ok).toBe(false)
  })

  it('不传 tracer 时不报错（默认 NOOP）', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
  })
})
