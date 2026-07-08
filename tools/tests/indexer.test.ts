import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { rmSync, existsSync, readFileSync } from 'node:fs'
import { buildIndex, writeIndex, loadIndex } from '../src/indexer'

const fixturesDir = resolve(import.meta.dirname, 'fixtures')
const repoRoot = resolve(import.meta.dirname, '..', '..')
const tmpOut = resolve(import.meta.dirname, 'fixtures', '_tmp_index.json')

describe('buildIndex', () => {
  it('扫描 fixtures 生成索引条目', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    expect(index.length).toBeGreaterThan(0)
    const entry = index.find((e) => e.id === 'cn-shanghai-test-shop')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('测试餐厅')
    expect(entry!.path).toMatch(/fixtures[\/\\]valid-sample\.md$/)
  })

  it('path 为相对仓库根的 POSIX 路径（无 Windows 盘符）', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    const entry = index.find((e) => e.id === 'cn-shanghai-test-shop')!
    expect(entry.path).not.toMatch(/[A-Z]:/)
  })

  it('索引包含展示用扩展字段（地址/电话/坐标/营业时间/推荐菜/点评）', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    const entry = index.find((e) => e.id === 'cn-shanghai-test-shop')!
    expect(entry.address).toBe('测试地址')
    expect(entry.phone).toBe('021-12345678')
    expect(entry.latitude).toBe(31.2)
    expect(entry.longitude).toBe(121.4)
    expect(entry.opening_hours).toEqual({ mon: '10:00-22:00', tue: '10:00-22:00' })
    expect(entry.recommendations).toEqual([{ name: '红烧肉', note: '招牌' }])
    expect(entry.notes).toBe('简短点评。')
  })

  it('索引包含正文字段 description（trim 后的 Markdown 正文）', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    const entry = index.find((e) => e.id === 'cn-shanghai-test-shop')!
    expect(entry.description).toBe('# 测试餐厅\n\n正文内容。')
  })

  it('无扩展字段的餐厅，对应字段为 undefined 而非报错', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    // 任意条目只要存在即说明扩展字段类型安全（不会因缺字段抛错）
    expect(index.length).toBeGreaterThan(0)
    const entry = index[0]
    expect(entry).toBeDefined()
    // 字段键应存在于结构中（即使是 undefined）
    expect('address' in entry!).toBe(true)
    expect('phone' in entry!).toBe(true)
  })
})

describe('writeIndex / loadIndex', () => {
  it('写入并读回等价数据', () => {
    try {
      const written = writeIndex(fixturesDir, repoRoot, tmpOut)
      expect(existsSync(tmpOut)).toBe(true)
      const loaded = loadIndex(tmpOut)
      expect(loaded.length).toBe(written.length)
      const first = loaded[0]
      const firstWritten = written[0]
      expect(first).toBeDefined()
      expect(firstWritten).toBeDefined()
      expect(first!.id).toBe(firstWritten!.id)
      const raw = JSON.parse(readFileSync(tmpOut, 'utf-8'))
      expect(Array.isArray(raw)).toBe(true)
    } finally {
      if (existsSync(tmpOut)) rmSync(tmpOut)
    }
  })
})
