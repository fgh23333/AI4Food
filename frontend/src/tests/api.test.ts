import { describe, it, expect, vi, beforeEach } from 'vitest'
import { askRecommend, generateDraft, fetchRestaurants, fetchMeta, fetchRestaurantById, ApiError } from '@/lib/api'

// 模拟 fetch，验证 API 客户端正确拼装请求与解析响应
function mockFetch(response: Response | Error): void {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fn)
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('askRecommend', () => {
  it('成功返回推荐 JSON', async () => {
    mockFetch(jsonRes({ answer: '推荐 A', picks: [{ id: 'x', reason: 'r', score: 0.9 }], candidates_considered: 5, model: 'm' }))
    const r = await askRecommend('上海日料')
    expect(r.answer).toBe('推荐 A')
    expect(r.picks[0]?.id).toBe('x')
    expect(r.candidates_considered).toBe(5)
    // 验证请求拼装
    const fn = vi.mocked(fetch)
    expect(fn).toHaveBeenCalledOnce()
    const [url, init] = fn.mock.calls[0]!
    expect(String(url)).toMatch(/\/api\/ai\/recommend$/)
    expect(init?.method).toBe('POST')
    const body = JSON.parse((init?.body as string) ?? '{}')
    expect(body.question).toBe('上海日料')
  })

  it('500 抛 ApiError 且 status 正确', async () => {
    mockFetch(jsonRes({ error: 'internal' }, 500))
    await expect(askRecommend('x')).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  it('503 抛 ApiError（AI 未就绪）', async () => {
    mockFetch(jsonRes({ error: 'no llm' }, 503))
    const e = (await askRecommend('x').catch((err: unknown) => err)) as ApiError
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(503)
  })

  it('网络错误抛原 Error', async () => {
    mockFetch(new TypeError('network'))
    await expect(askRecommend('x')).rejects.toThrow('network')
  })
})

describe('generateDraft', () => {
  it('成功返回草稿 JSON', async () => {
    mockFetch(jsonRes({ draft: { name: '新店', cuisine: '本帮菜', price_level: 3, status: 'open' }, warnings: ['缺电话'], model: 'm' }))
    const r = await generateDraft('愚园路本帮菜')
    expect(r.draft.name).toBe('新店')
    expect(r.warnings).toHaveLength(1)
    const fn = vi.mocked(fetch)
    const [url, init] = fn.mock.calls[0]!
    expect(String(url)).toMatch(/\/api\/ai\/draft$/)
    const body = JSON.parse((init?.body as string) ?? '{}')
    expect(body.description).toBe('愚园路本帮菜')
  })

  it('400 抛 ApiError', async () => {
    mockFetch(jsonRes({ error: 'bad request' }, 400))
    await expect(generateDraft('')).rejects.toMatchObject({ name: 'ApiError', status: 400 })
  })
})

describe('fetchRestaurants', () => {
  it('成功返回 data 数组', async () => {
    mockFetch(jsonRes({ data: [{ id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜', price_level: 2, status: 'open', path: 'p' }], pagination: { total: 1, limit: 2000, offset: 0, returned: 1 } }))
    const r = await fetchRestaurants()
    expect(r).toHaveLength(1)
    expect(r[0]?.id).toBe('x')
    const url = String(vi.mocked(fetch).mock.calls[0]![0])
    expect(url).toMatch(/\/api\/restaurants/)
    const body = vi.mocked(fetch).mock.calls[0]![1] as RequestInit | undefined
    expect(body?.method ?? 'GET').toBe('GET')
  })
  it('500 抛 ApiError', async () => {
    mockFetch(jsonRes({ error: 'boom' }, 500))
    await expect(fetchRestaurants()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('fetchMeta', () => {
  it('返回 Meta', async () => {
    mockFetch(jsonRes({ total: 5, open: 4, cities: ['上海'], cuisines: ['本帮菜'], price_levels: [1, 2] }))
    const m = await fetchMeta()
    expect(m.total).toBe(5)
    expect(m.cuisines).toContain('本帮菜')
  })
})

describe('fetchRestaurantById', () => {
  it('200 返回 entry', async () => {
    mockFetch(jsonRes({ id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜', price_level: 2, status: 'open', path: 'p' }))
    const r = await fetchRestaurantById('x')
    expect(r?.id).toBe('x')
  })
  it('404 返回 null', async () => {
    mockFetch(jsonRes({ error: 'not found' }, 404))
    const r = await fetchRestaurantById('missing')
    expect(r).toBeNull()
  })
})
