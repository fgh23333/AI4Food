import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { validateRecord, validateAll } from '../src/validator'
import { parseFrontmatter } from '../src/frontmatter'

const fixturesDir = resolve(import.meta.dirname, 'fixtures')

describe('validateRecord', () => {
  it('合法样本无 error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'valid-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors).toEqual([])
  })

  it('枚举非法 + 坐标越界 + price_level 越界 → error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'invalid-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
    expect(result.errors.some((e) => e.message.includes('cuisine'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('price_level'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('status'))).toBe(true)
  })

  it('缺推荐字段 → warning 而非 error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'warning-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors).toEqual([])
    expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    expect(result.warnings.some((w) => w.message.includes('address'))).toBe(true)
  })
})

describe('validateAll', () => {
  it('返回 checked 计数与合并结果', () => {
    const result = validateAll(fixturesDir)
    expect(result.checked).toBeGreaterThan(0)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    // invalid-sample 至少贡献 error
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
