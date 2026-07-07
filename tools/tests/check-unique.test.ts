import { describe, it, expect } from 'vitest'
import { checkUnique } from '../src/check-unique'
import type { RestaurantRecord } from '../src/types'

function mk(id: string, path: string): RestaurantRecord {
  return {
    frontmatter: {
      id,
      name: 'x',
      city: 'beijing',
      country: 'cn',
      cuisine: '京菜',
      price_level: 3,
      status: 'open',
    },
    body: '',
    filePath: path,
  }
}

describe('checkUnique', () => {
  it('全部唯一且 country 一致时无 error', () => {
    const recs = [
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/a.md'),
      mk('cn-beijing-b', '/repo/data/restaurants/cn/beijing/b.md'),
    ]
    expect(checkUnique(recs)).toEqual([])
  })

  it('id 重复时报 error', () => {
    const recs = [
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/a.md'),
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/b.md'),
    ]
    const issues = checkUnique(recs)
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues.every((i) => i.type === 'error')).toBe(true)
    expect(issues.some((i) => i.message.includes('重复'))).toBe(true)
  })

  it('id 首段与路径 country 目录不一致时报 error', () => {
    const recs = [mk('cn-beijing-a', '/repo/data/restaurants/jp/tokyo/a.md')]
    const issues = checkUnique(recs)
    expect(issues.length).toBe(1)
    const first = issues[0]
    expect(first).toBeDefined()
    expect(first!.type).toBe('error')
    expect(first!.message).toContain('country')
  })
})
