import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import matter from 'gray-matter'
import type { RestaurantFrontmatter, RestaurantRecord } from './types'

export function parseFrontmatter(filePath: string): RestaurantRecord {
  const abs = resolve(filePath)
  const raw = readFileSync(abs, 'utf-8')
  const parsed = matter(raw)
  return {
    frontmatter: parsed.data as RestaurantFrontmatter,
    body: parsed.content,
    filePath: abs,
  }
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
