import { describe, it, expect } from 'vitest'
import {
  filterBy,
  sortBy,
  paginate,
  buildMeta,
  applyQuery,
} from '../../src/server/query'
import type { IndexEntry } from '../../src/indexer'

// 内联样本：覆盖 city/cuisine/price/status/tag/rating 有无/updated_at 有无
function sample(): IndexEntry[] {
  return [
    {
      id: 'cn-shanghai-a',
      name: '阿强饭店',
      city: '上海',
      country: 'cn',
      cuisine: '本帮菜',
      price_level: 2,
      status: 'open',
      rating: 4.5,
      tags: ['本帮', '老字号'],
      address: '南京东路100号',
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
      status: 'open',
      rating: 4.0,
      tags: ['西餐', '情侣约会'],
      address: '淮海中路200号',
      path: 'data/b.md',
      updated_at: '2026-07-01',
    },
    {
      id: 'cn-shanghai-c',
      name: '川味轩',
      city: '上海',
      country: 'cn',
      cuisine: '川菜',
      price_level: 2,
      status: 'closed',
      tags: ['川菜', '辣'],
      address: '陆家嘴300号',
      path: 'data/c.md',
      updated_at: '2025-01-01',
    },
    {
      id: 'cn-beijing-d',
      name: '京味楼',
      city: '北京',
      country: 'cn',
      cuisine: '京菜',
      price_level: 3,
      status: 'open',
      rating: 5,
      tags: ['京菜', '商务'],
      address: '三里屯50号',
      path: 'data/d.md',
      updated_at: '2026-07-07',
    },
  ]
}

describe('filterBy', () => {
  it('按 city 精确筛选', () => {
    const r = filterBy(sample(), { city: '上海' })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-a', 'cn-shanghai-b', 'cn-shanghai-c'])
  })

  it('按 cuisine 精确筛选', () => {
    const r = filterBy(sample(), { cuisine: '西餐' })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-b'])
  })

  it('按 price_level 精确筛选', () => {
    const r = filterBy(sample(), { price: 2 })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-a', 'cn-shanghai-c'])
  })

  it('按 status 精确筛选', () => {
    const r = filterBy(sample(), { status: 'closed' })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-c'])
  })

  it('按 tag 精确筛选', () => {
    const r = filterBy(sample(), { tag: '情侣约会' })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-b'])
  })

  it('组合多条件（AND 语义）', () => {
    const r = filterBy(sample(), { city: '上海', price: 2, status: 'open' })
    expect(r.map((e) => e.id)).toEqual(['cn-shanghai-a'])
  })

  it('模糊搜索 q 匹配 name/address/cuisine/tags（大小写不敏感）', () => {
    expect(filterBy(sample(), { q: 'bistro' }).map((e) => e.id)).toEqual(['cn-shanghai-b'])
    expect(filterBy(sample(), { q: '陆家嘴' }).map((e) => e.id)).toEqual(['cn-shanghai-c'])
    expect(filterBy(sample(), { q: '西餐' }).map((e) => e.id)).toEqual(['cn-shanghai-b'])
    expect(filterBy(sample(), { q: '商务' }).map((e) => e.id)).toEqual(['cn-beijing-d'])
  })

  it('q 为空串时不筛除任何条目', () => {
    expect(filterBy(sample(), { q: '' }).length).toBe(4)
  })

  it('无任何参数返回全部', () => {
    expect(filterBy(sample(), {}).length).toBe(4)
  })
})

describe('sortBy', () => {
  it('按 name 排序（zh locale，汉字按拼音、拉丁字母排末尾，默认）', () => {
    // zh collator: 阿强(a) < 川(chuan) < 京(jing) < Bistro(拉丁排后)
    const r = sortBy(sample(), 'name')
    expect(r.map((e) => e.id)).toEqual([
      'cn-shanghai-a',
      'cn-shanghai-c',
      'cn-beijing-d',
      'cn-shanghai-b',
    ])
  })

  it('按 rating 降序，缺失 rating 排末尾', () => {
    const r = sortBy(sample(), 'rating')
    expect(r.map((e) => e.id)).toEqual([
      'cn-beijing-d', // 5
      'cn-shanghai-a', // 4.5
      'cn-shanghai-b', // 4.0
      'cn-shanghai-c', // undefined 末尾
    ])
  })

  it('按 updated 降序，缺失排末尾', () => {
    const r = sortBy(sample(), 'updated')
    expect(r.map((e) => e.id)).toEqual([
      'cn-shanghai-a', // 2026-07-08
      'cn-beijing-d', // 2026-07-07
      'cn-shanghai-b', // 2026-07-01
      'cn-shanghai-c', // 2025-01-01
    ])
  })
})

describe('paginate', () => {
  it('默认 limit/offset 返回全部', () => {
    const { data, pagination } = paginate(sample(), 50, 0)
    expect(data.length).toBe(4)
    expect(pagination).toEqual({ total: 4, limit: 50, offset: 0, returned: 4 })
  })

  it('limit 截断', () => {
    const { data, pagination } = paginate(sample(), 2, 0)
    expect(data.length).toBe(2)
    expect(pagination.returned).toBe(2)
    expect(pagination.total).toBe(4)
  })

  it('offset 跳过', () => {
    const { data, pagination } = paginate(sample(), 50, 2)
    expect(data.length).toBe(2)
    expect(pagination.offset).toBe(2)
  })

  it('offset 超出返回空数组', () => {
    const { data, pagination } = paginate(sample(), 50, 100)
    expect(data).toEqual([])
    expect(pagination.returned).toBe(0)
    expect(pagination.total).toBe(4)
  })
})

describe('buildMeta', () => {
  it('汇总 total/open/cities/cuisines/price_levels', () => {
    const meta = buildMeta(sample())
    expect(meta.total).toBe(4)
    expect(meta.open).toBe(3)
    expect(meta.cities.sort()).toEqual(['上海', '北京'])
    expect(meta.cuisines.sort()).toEqual(['京菜', '川菜', '本帮菜', '西餐'])
    expect(meta.price_levels.sort()).toEqual([2, 3, 4])
  })
})

describe('applyQuery（组合入口）', () => {
  it('筛选→排序→分页 全链路', () => {
    const { data, pagination } = applyQuery(sample(), {
      city: '上海',
      sort: 'rating',
      limit: 10,
      offset: 0,
    })
    expect(data.map((e) => e.id)).toEqual([
      'cn-shanghai-a', // 4.5
      'cn-shanghai-b', // 4.0
      'cn-shanghai-c', // undefined 末尾（上海+closed 也含）
    ])
    expect(pagination.total).toBe(3)
  })

  it('limit 截断排序后的结果', () => {
    const { data, pagination } = applyQuery(sample(), {
      sort: 'rating',
      limit: 2,
      offset: 0,
    })
    expect(data.map((e) => e.id)).toEqual(['cn-beijing-d', 'cn-shanghai-a'])
    expect(pagination.total).toBe(4)
    expect(pagination.returned).toBe(2)
  })
})
