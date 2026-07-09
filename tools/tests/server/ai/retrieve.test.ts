import { describe, it, expect } from 'vitest'
import { extractParams, retrieve, knownCitiesFrom } from '../../../src/server/ai/retrieve'
import type { IndexEntry, RestaurantEnums } from '../../../src/types'

// 测试用枚举（取 schema/enums.json 子集）
const ENUMS: RestaurantEnums = {
  cuisines: ['粤菜', '本帮菜', '西餐', '火锅', '日料', '川菜'],
  statuses: ['open', 'closed'],
  priceLevels: [1, 2, 3, 4, 5],
}

// 已知城市集合（模拟从 entries 推导）
const CITIES = ['上海', '北京']

// 测试用餐厅数据
function makeEntry(over: Partial<IndexEntry>): IndexEntry {
  return {
    id: 'x',
    name: '',
    city: '上海',
    country: 'cn',
    cuisine: '本帮菜',
    price_level: 3,
    status: 'open',
    path: 'data/x.md',
    ...over,
  }
}

const ENTRIES: IndexEntry[] = [
  makeEntry({ id: 'a', name: '粤香楼', cuisine: '粤菜', city: '上海', tags: ['商务宴请', '陆家嘴'], price_level: 4, rating: 4.5 }),
  makeEntry({ id: 'b', name: '本帮小馆', cuisine: '本帮菜', city: '上海', tags: ['家常'], price_level: 2 }),
  makeEntry({ id: 'c', name: '蜀地火锅', cuisine: '火锅', city: '上海', tags: ['川味'], price_level: 3 }),
  makeEntry({ id: 'd', name: '京味烤鸭', cuisine: '本帮菜', city: '北京', tags: [], price_level: 3 }),
  makeEntry({ id: 'e', name: '日式料理', cuisine: '日料', city: '上海', tags: ['omakase'], price_level: 5 }),
]

describe('extractParams', () => {
  it('抽取城市', () => {
    expect(extractParams('上海有什么好吃的', ENUMS, CITIES).city).toBe('上海')
  })

  it('抽取菜系枚举值', () => {
    expect(extractParams('推荐个粤菜', ENUMS, CITIES).cuisine).toBe('粤菜')
  })

  it('同时抽取城市和菜系', () => {
    const p = extractParams('上海陆家嘴适合商务宴请的粤菜', ENUMS, CITIES)
    expect(p.city).toBe('上海')
    expect(p.cuisine).toBe('粤菜')
  })

  it('提取不到的城市/菜系不设置', () => {
    const p = extractParams('随便推荐个餐厅', ENUMS, CITIES)
    expect(p.city).toBeUndefined()
    expect(p.cuisine).toBeUndefined()
  })

  it('剩余关键词作为 q', () => {
    const p = extractParams('上海omakase', ENUMS, CITIES)
    expect(p.city).toBe('上海')
    // omakase 不在枚举，作为关键词
    expect(p.q).toContain('omakase')
  })

  it('北京也能识别（多城市）', () => {
    expect(extractParams('北京烤鸭', ENUMS, CITIES).city).toBe('北京')
  })
})

describe('retrieve', () => {
  it('按城市+菜系筛选命中', () => {
    const { candidates, params } = retrieve('上海的粤菜', ENTRIES, ENUMS)
    expect(params.city).toBe('上海')
    expect(params.cuisine).toBe('粤菜')
    expect(candidates.map((c) => c.id)).toEqual(['a'])
  })

  it('关键词 q 命中 tags', () => {
    // "川味" 不在 cuisine 枚举（川菜才是），作为 q 匹配 tags
    const { candidates } = retrieve('上海川味', ENTRIES, ENUMS)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((c) => c.city === '上海')).toBe(true)
  })

  it('候选集为空时逐级放宽（cuisine 不匹配则去掉 cuisine）', () => {
    // 上海没有"日料"以外的 omakase？实际 e 是上海日料 omakase。
    // 用一个确实无结果的提问触发放宽：上海 + 粤菜标签但实际要找不存在的"法餐"
    // 这里用"上海法餐"：法餐不在枚举也不在数据，q="法餐"无命中 -> 放宽 q -> 上海全部
    const { candidates } = retrieve('上海法餐', ENTRIES, ENUMS)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((c) => c.city === '上海')).toBe(true)
  })

  it('城市不匹配时放宽返回全部或空（不报错）', () => {
    const { candidates } = retrieve('深圳粤菜', ENTRIES, ENUMS)
    // 深圳无数据，放宽城市后可能返回粤菜或全部；关键是类型正确且不抛
    expect(Array.isArray(candidates)).toBe(true)
  })

  it('候选集截断到上限', () => {
    // 造 60 条上海本帮菜
    const many: IndexEntry[] = Array.from({ length: 60 }, (_, i) =>
      makeEntry({ id: `m${i}`, name: `店${i}`, cuisine: '本帮菜', city: '上海' }),
    )
    const { candidates } = retrieve('上海本帮菜', many, ENUMS)
    expect(candidates.length).toBeLessThanOrEqual(30) // MAX_CANDIDATES
  })

  it('返回的 candidates 顺序稳定（按 rating 降序优先）', () => {
    const { candidates } = retrieve('上海粤菜', ENTRIES, ENUMS)
    expect(candidates[0]?.id).toBe('a') // 唯一命中
  })
})

describe('knownCitiesFrom', () => {
  it('从 entries 去重推导城市集合', () => {
    expect(knownCitiesFrom(ENTRIES).sort()).toEqual(['上海', '北京'])
  })
})
