import { describe, it, expect } from 'vitest'
import { haversineKm, sortByDistance, formatDistance } from '@/lib/distance'

describe('haversineKm', () => {
  it('同点距离为 0', () => {
    expect(haversineKm(31.23, 121.47, 31.23, 121.47)).toBeCloseTo(0, 5)
  })

  it('上海到北京约 1067km（容差 ±20）', () => {
    const d = haversineKm(31.2304, 121.4737, 39.9042, 116.4074)
    expect(d).toBeGreaterThan(1050)
    expect(d).toBeLessThan(1090)
  })

  it('距离对称', () => {
    const a = haversineKm(31, 121, 32, 122)
    const b = haversineKm(32, 122, 31, 121)
    expect(a).toBeCloseTo(b, 5)
  })
})

describe('sortByDistance', () => {
  const items = [
    { id: 'a', latitude: 31.0, longitude: 121.0 },
    { id: 'b', latitude: 31.5, longitude: 121.5 },
    { id: 'c' },
    { id: 'd', latitude: undefined, longitude: 121.0 },
  ]

  it('有坐标按距离升序，无坐标置底', () => {
    const sorted = sortByDistance(items, { lat: 31.5, lng: 121.5 })
    expect(sorted.map((x) => x.item.id)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('b 与 origin 同点距离为 0', () => {
    const sorted = sortByDistance(items, { lat: 31.5, lng: 121.5 })
    expect(sorted[0]!.km).toBeCloseTo(0, 1)
  })

  it('无坐标项 km 为 undefined', () => {
    const sorted = sortByDistance(items, { lat: 31.5, lng: 121.5 })
    expect(sorted[2]!.km).toBeUndefined()
    expect(sorted[3]!.km).toBeUndefined()
  })
})

describe('formatDistance', () => {
  it('小于 1km 显示米', () => {
    expect(formatDistance(0.3)).toBe('300m')
    expect(formatDistance(0.05)).toBe('50m')
  })
  it('大于等于 1km 保留一位小数', () => {
    expect(formatDistance(2.34)).toBe('2.3km')
    expect(formatDistance(1.0)).toBe('1.0km')
  })
})
