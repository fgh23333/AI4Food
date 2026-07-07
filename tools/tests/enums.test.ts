import { describe, it, expect } from 'vitest'
import { loadEnums } from '../src/enums'

describe('loadEnums', () => {
  it('从 schema/enums.json 读取枚举', () => {
    const enums = loadEnums()
    expect(Array.isArray(enums.cuisines)).toBe(true)
    expect(enums.cuisines.length).toBeGreaterThan(0)
    expect(enums.statuses).toContain('open')
    expect(enums.statuses).toContain('closed')
    expect(enums.priceLevels).toEqual([1, 2, 3, 4, 5])
  })

  it('cuisines 不为空且每个为字符串', () => {
    const enums = loadEnums()
    for (const c of enums.cuisines) {
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })
})
