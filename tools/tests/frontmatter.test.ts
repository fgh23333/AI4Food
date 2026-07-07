import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { parseFrontmatter, scanRestaurantFiles } from '../src/frontmatter'

const fixture = resolve(import.meta.dirname, 'fixtures', 'valid-sample.md')

describe('parseFrontmatter', () => {
  it('解析合法 md 的 frontmatter 与 body', () => {
    const rec = parseFrontmatter(fixture)
    expect(rec.frontmatter.id).toBe('cn-beijing-test-shop')
    expect(rec.frontmatter.name).toBe('测试餐厅')
    expect(rec.frontmatter.price_level).toBe(3)
    expect(rec.body).toContain('# 测试餐厅')
    expect(rec.filePath).toBe(fixture)
  })

  it('phone 字段保留为字符串', () => {
    const rec = parseFrontmatter(fixture)
    expect(rec.frontmatter.phone).toBe('010-12345678')
    expect(typeof rec.frontmatter.phone).toBe('string')
  })
})

describe('scanRestaurantFiles', () => {
  it('递归返回 md 文件并排除下划线前缀文件', () => {
    const dir = resolve(import.meta.dirname, 'fixtures')
    const files = scanRestaurantFiles(dir)
    expect(files.map((f) => resolve(f))).toContain(resolve(fixture))
    for (const f of files) {
      expect(f.includes('_template')).toBe(false)
    }
  })
})
