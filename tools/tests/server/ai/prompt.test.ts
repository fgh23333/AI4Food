import { describe, it, expect } from 'vitest'
import { buildRecommendPrompt, buildDraftPrompt, summarizeCandidate } from '../../../src/server/ai/prompt'
import type { IndexEntry, RestaurantEnums } from '../../../src/types'

const ENUMS: RestaurantEnums = {
  cuisines: ['粤菜', '本帮菜', '西餐'],
  statuses: ['open', 'closed'],
  priceLevels: [1, 2, 3, 4, 5],
}

const ENTRY: IndexEntry = {
  id: 'cn-shanghai-x',
  name: '粤香楼',
  city: '上海',
  country: 'cn',
  cuisine: '粤菜',
  price_level: 4,
  status: 'open',
  rating: 4.5,
  tags: ['商务宴请', '陆家嘴'],
  address: '上海陆家嘴',
  notes: '高端粤菜',
  path: 'data/x.md',
}

describe('summarizeCandidate', () => {
  it('输出精简字段（id/name/cuisine/price/tags 等）', () => {
    const s = summarizeCandidate(ENTRY)
    expect(s.id).toBe('cn-shanghai-x')
    expect(s.name).toBe('粤香楼')
    expect(s.cuisine).toBe('粤菜')
    expect(s.price_level).toBe(4)
    expect(s.rating).toBe(4.5)
    expect(s.tags).toEqual(['商务宴请', '陆家嘴'])
  })

  it('不包含冗长字段（description 全文/phone/opening_hours）', () => {
    const s = summarizeCandidate(ENTRY)
    expect(s).not.toHaveProperty('description')
    expect(s).not.toHaveProperty('phone')
    expect(s).not.toHaveProperty('opening_hours')
    expect(s).not.toHaveProperty('path')
  })
})

describe('buildRecommendPrompt', () => {
  const question = '上海陆家嘴适合商务宴请的粤菜'
  const candidates: IndexEntry[] = [ENTRY]

  it('system 含防幻觉约束（只能从候选集选）', () => {
    const { system } = buildRecommendPrompt(question, candidates)
    expect(system).toContain('候选')
    expect(system.toLowerCase()).toMatch(/只能|必须|禁止编造|不要编造/)
  })

  it('system 要求 JSON 输出', () => {
    const { system } = buildRecommendPrompt(question, candidates)
    expect(system).toMatch(/JSON|json/)
  })

  it('user 含候选集 id', () => {
    const { user } = buildRecommendPrompt(question, candidates)
    expect(user).toContain('cn-shanghai-x')
    expect(user).toContain('粤香楼')
  })

  it('user 含原始提问', () => {
    const { user } = buildRecommendPrompt(question, candidates)
    expect(user).toContain(question)
  })

  it('候选集为空时仍能构建（提示无候选）', () => {
    const { system, user } = buildRecommendPrompt('随便', [])
    expect(system).toBeTruthy()
    expect(user).toContain('随便')
  })
})

describe('buildDraftPrompt', () => {
  const desc = '静安寺日料omakase人均500'

  it('system 含枚举值约束', () => {
    const { system } = buildDraftPrompt(desc, ENUMS)
    expect(system).toContain('粤菜')
    expect(system).toContain('open')
    expect(system).toContain('closed')
  })

  it('system 要求 JSON 输出与必填字段', () => {
    const { system } = buildDraftPrompt(desc, ENUMS)
    expect(system).toMatch(/JSON|json/)
    expect(system).toContain('name')
    expect(system).toContain('cuisine')
    expect(system).toContain('price_level')
  })

  it('user 含原始描述', () => {
    const { user } = buildDraftPrompt(desc, ENUMS)
    expect(user).toContain(desc)
  })
})
