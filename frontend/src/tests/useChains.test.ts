import { describe, it, expect } from 'vitest'
import { toDisplayItems, brandKey, branchClosed, branchLabel, averageRating } from '@/composables/useChains'
import type { RestaurantEntry } from '@/types/restaurant'

const mk = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试', city: '上海', country: 'cn',
  cuisine: '西餐', price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md', ...over,
})

describe('useChains', () => {
  it('brandKey 取 id 第三段', () => {
    expect(brandKey(mk({ id: 'cn-shanghai-chilis-pudong' }))).toBe('chilis')
  })
  it('branchClosed 识别 status 与 已关店 tag', () => {
    expect(branchClosed(mk({ status: 'closed' }))).toBe(true)
    expect(branchClosed(mk({ status: 'open', tags: ['已关店'] }))).toBe(true)
    expect(branchClosed(mk({ status: 'open' }))).toBe(false)
  })
  it('branchLabel 从 address 剥掉市/区', () => {
    expect(branchLabel(mk({ address: '上海市徐汇区徐汇万科广场' }))).toBe('徐汇万科广场')
    expect(branchLabel(mk({ address: '上海市静安区陕西北路100号' }))).toBe('陕西北路100号')
  })
  it('averageRating 忽略无评分', () => {
    expect(averageRating([mk({ rating: 4 }), mk({ rating: 5 }), mk({})])).toBeCloseTo(4.5)
    expect(averageRating([mk({}), mk({})])).toBeNull()
  })
  it('toDisplayItems 合并 ≥2 家、单店独立', () => {
    const list: RestaurantEntry[] = [
      mk({ id: 'cn-shanghai-chilis-a', name: "Chili's" }),
      mk({ id: 'cn-shanghai-chilis-b', name: "Chili's" }),
      mk({ id: 'cn-shanghai-solo-x', name: '独店' }),
    ]
    const items = toDisplayItems(list, true)
    expect(items).toHaveLength(2)
    const chain = items.find((i) => i.type === 'chain')
    expect(chain && chain.type === 'chain' && chain.brand.branches).toHaveLength(2)
    expect(items.find((i) => i.type === 'single')).toBeDefined()
  })
  it('mergeChains=false 时全部为 single', () => {
    const list: RestaurantEntry[] = [
      mk({ id: 'cn-shanghai-chilis-a', name: "Chili's" }),
      mk({ id: 'cn-shanghai-chilis-b', name: "Chili's" }),
    ]
    expect(toDisplayItems(list, false).every((i) => i.type === 'single')).toBe(true)
  })
})
