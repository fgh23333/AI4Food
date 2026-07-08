import { describe, it, expect } from 'vitest'
import { filterRestaurants } from '@/composables/useFilter'
import type { RestaurantEntry } from '@/types/restaurant'

const mk = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试', city: '上海', country: 'cn',
  cuisine: '西餐', price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md', ...over,
})

describe('filterRestaurants', () => {
  const data: RestaurantEntry[] = [
    mk({ id: 'cn-shanghai-a', name: '甲店', cuisine: '西餐', price_level: 2, status: 'open', tags: ['汉堡'], recommendations: [{ name: '安格斯' }] }),
    mk({ id: 'cn-shanghai-b', name: '乙店', cuisine: '火锅', price_level: 3, status: 'closed' }),
    mk({ id: 'cn-shanghai-c', name: '丙店', cuisine: '西餐', price_level: 4, status: 'open', address: '南京路', notes: '环境好' }),
  ]

  it('onlyOpen 过滤掉非营业', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '', price: 0, onlyOpen: true })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-a', 'cn-shanghai-c'])
  })
  it('cuisine 筛选', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '火锅', price: 0, onlyOpen: false })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-b'])
  })
  it('price 筛选', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '', price: 4, onlyOpen: false })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-c'])
  })
  it('query 命中 name/address/notes/tags/推荐菜', () => {
    expect(filterRestaurants(data, { query: '甲', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-a'])
    expect(filterRestaurants(data, { query: '南京', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-c'])
    expect(filterRestaurants(data, { query: '安格斯', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-a'])
  })
  it('description 也参与搜索', () => {
    const d = [mk({ id: 'cn-shanghai-d', description: '这是探店正文，提到招牌红烧肉' })]
    expect(filterRestaurants(d, { query: '红烧肉', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-d'])
  })
})
