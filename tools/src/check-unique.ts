import type { RestaurantRecord, ValidationIssue } from './types'

// 兼容 POSIX 与 Windows 路径分隔符
function extractPathSegments(filePath: string): { country?: string; city?: string } {
  const parts = filePath.split(/[\\/]/)
  const idx = parts.lastIndexOf('restaurants')
  if (idx === -1 || idx + 2 >= parts.length) return {}
  return { country: parts[idx + 1], city: parts[idx + 2] }
}

export function checkUnique(records: RestaurantRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, string>() // id -> first filePath

  for (const rec of records) {
    const { id } = rec.frontmatter
    const { country } = extractPathSegments(rec.filePath)

    // 1. id 首段必须等于路径 country 目录
    const idCountry = id.split('-')[0]
    if (country && idCountry !== country) {
      issues.push({
        type: 'error',
        path: rec.filePath,
        message: `id 首段 "${idCountry}" 与路径 country 目录 "${country}" 不一致`,
      })
    }

    // 2. id 全局唯一
    const prev = seen.get(id)
    if (prev) {
      issues.push({
        type: 'error',
        path: rec.filePath,
        message: `id "${id}" 与 ${prev} 重复`,
      })
    } else {
      seen.set(id, rec.filePath)
    }
  }

  return issues
}
