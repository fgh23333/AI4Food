import { describe, it, expect } from 'vitest'
import { missingFields, buildEnrichUrl } from '@/lib/enrichDraft'
import type { RestaurantEntry } from '@/types/restaurant'

const full: RestaurantEntry = {
  id: 'cn-shanghai-x', name: '测试', city: '上海', country: 'cn',
  cuisine: '本帮菜', price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md',
  address: '某路1号', latitude: 31.2, longitude: 121.4, phone: '021-1234',
  opening_hours: { mon: '10:00-22:00' },
}
const mk = (over: Partial<RestaurantEntry>): RestaurantEntry => ({ ...full, ...over })

describe('missingFields', () => {
  it('字段齐全时返回空', () => {
    expect(missingFields(mk({}))).toEqual([])
  })

  it('缺坐标（成对校验，缺一经度也算）', () => {
    expect(missingFields(mk({ latitude: 31.2, longitude: undefined }))).toEqual([{ key: 'coords', label: '坐标' }])
    expect(missingFields(mk({ latitude: undefined, longitude: 121.4 }))).toEqual([{ key: 'coords', label: '坐标' }])
  })

  it('缺电话/地址/营业时间分别识别', () => {
    expect(missingFields(mk({ phone: undefined }))).toContainEqual({ key: 'phone', label: '电话' })
    expect(missingFields(mk({ address: undefined }))).toContainEqual({ key: 'address', label: '地址' })
  })

  it('营业时间为空对象视为缺失', () => {
    expect(missingFields(mk({ opening_hours: {} }))).toContainEqual({ key: 'hours', label: '营业时间' })
  })

  it('多项缺失全部列出', () => {
    const gaps = missingFields(
      mk({ phone: undefined, address: undefined, latitude: undefined, longitude: undefined }),
    )
    const keys = gaps.map((g) => g.key)
    expect(keys).toEqual(expect.arrayContaining(['address', 'coords', 'phone']))
  })
})

describe('buildEnrichUrl', () => {
  it('指向 GitHub edit 端点，不预填 value（避免覆盖原数据）', () => {
    const url = buildEnrichUrl(mk({ path: 'data/restaurants/cn/shanghai/x.md' }))
    expect(url).toBe('https://github.com/fgh23333/AI4Food/edit/main/data/restaurants/cn/shanghai/x.md')
    expect(url).not.toContain('?value=')
  })
})
