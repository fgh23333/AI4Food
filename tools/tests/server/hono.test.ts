import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/hono'
import type { DataLoader } from '../../src/server/loader'
import type { IndexEntry } from '../../src/indexer'

// 内存假 loader，注入固定数据
function fakeLoader(entries: IndexEntry[]): DataLoader {
  return { async loadAll() { return entries } }
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
