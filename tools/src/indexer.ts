import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { scanRestaurantFiles, parseFrontmatter } from './frontmatter'
import type { RestaurantFrontmatter } from './types'
import type { IndexEntry } from './types'

// re-export：IndexEntry 定义在 ./types（纯类型文件），此处对外保留导出以兼容现有引用。
export type { IndexEntry } from './types'

function toPosix(p: string): string {
  return p.split(sep).join('/')
}

export function buildIndex(dataDir: string, repoRoot: string): IndexEntry[] {
  const files = scanRestaurantFiles(dataDir)
  const entries: IndexEntry[] = []
  for (const file of files) {
    const { frontmatter: fm, body } = parseFrontmatter(file)
    const entry: IndexEntry = {
      id: fm.id,
      name: fm.name,
      city: fm.city,
      country: fm.country,
      cuisine: fm.cuisine,
      price_level: fm.price_level,
      status: fm.status,
      rating: fm.rating,
      tags: fm.tags,
      path: toPosix(relative(repoRoot, file)),
      updated_at: fm.updated_at,
      address: fm.address,
      latitude: fm.latitude,
      longitude: fm.longitude,
      phone: fm.phone,
      opening_hours: fm.opening_hours,
      recommendations: fm.recommendations,
      notes: fm.notes,
      description: body.trim(),
    }
    entries.push(entry)
  }
  return entries
}

export function writeIndex(dataDir: string, repoRoot: string, outPath: string): IndexEntry[] {
  const index = buildIndex(dataDir, repoRoot)
  const absOut = resolve(outPath)
  writeFileSync(absOut, JSON.stringify(index, null, 2) + '\n', 'utf-8')
  return index
}

// src/indexer.ts -> 仓库根（src -> tools -> 仓库根，退 2 层）
const defaultRepoRoot = resolve(import.meta.dirname, '..', '..')

export function loadIndex(distPath?: string): IndexEntry[] {
  const path = distPath ?? resolve(defaultRepoRoot, 'dist', 'index.json')
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf-8')) as IndexEntry[]
}
