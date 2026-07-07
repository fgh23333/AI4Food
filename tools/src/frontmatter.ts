import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import matter from 'gray-matter'
import type { RestaurantFrontmatter, RestaurantRecord } from './types'

export function parseFrontmatter(filePath: string): RestaurantRecord {
  const abs = resolve(filePath)
  const raw = readFileSync(abs, 'utf-8')
  const parsed = matter(raw)
  return {
    frontmatter: normalizeDates(parsed.data) as RestaurantFrontmatter,
    body: parsed.content,
    filePath: abs,
  }
}

// YAML 会把 2026-07-07 这类字面量解析成 Date 对象。
// 数据规范要求日期为字符串，统一转成 ISO 日期串。
function normalizeDates(obj: unknown): unknown {
  if (obj instanceof Date) {
    return obj.toISOString().slice(0, 10)
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeDates)
  }
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = normalizeDates(v)
    }
    return out
  }
  return obj
}

export function scanRestaurantFiles(dataDir: string): string[] {
  const results: string[] = []
  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const full = resolve(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (entry.endsWith('.md') && !entry.startsWith('_')) {
        results.push(full)
      }
    }
  }
  walk(resolve(dataDir))
  return results
}
