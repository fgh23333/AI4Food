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
