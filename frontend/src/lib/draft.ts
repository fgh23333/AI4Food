import type { RestaurantDraft } from '@/types/ai'

// ⚠️ 与 schema/enums.json 保持一致；改 schema 需同步此处。
// 前端为纯静态部署（GitHub Pages），无法读 schema/，故硬编码。
export const CUISINES = [
  '中餐', '京菜', '川菜', '粤菜', '淮扬菜', '浙菜', '本帮菜', '湘菜', '闽菜', '徽菜',
  '鲁菜', '鄂菜', '东北菜', '西北菜', '云南菜', '新疆菜', '火锅', '烧烤', '日料', '韩料',
  '东南亚菜', '西餐', '意大利菜', '法餐', '墨西哥菜', '中东菜', '素食', '面食小吃',
  '甜品烘焙', '饮品', '其他',
] as const

export const STATUSES = ['open', 'closed', 'relocated', 'demolished'] as const

export const PRICE_LEVELS = [1, 2, 3, 4, 5] as const

export const STATUS_LABEL: Record<string, string> = {
  open: '营业中',
  closed: '已关店',
  relocated: '已搬迁',
  demolished: '已拆除',
}

// 草稿是否缺关键字段（贡献者需补全）。与后端 draft.ts 的 warning 逻辑对应。
export function draftWarnings(d: RestaurantDraft): string[] {
  const w: string[] = []
  if (!d.name?.trim()) w.push('店名（name）为空')
  if (!d.address?.trim()) w.push('地址（address）未提供，需人工补充')
  if (!d.phone?.trim()) w.push('电话（phone）未提供，需人工补充')
  return w
}

// tags 数组 <-> 逗号分隔字符串（表单输入用）
export function tagsToString(tags?: string[]): string {
  return tags?.join(', ') ?? ''
}

export function parseTags(input: string): string[] {
  return input
    .split(/[,，、]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

// 把草稿转成 frontmatter 文本（含正文），便于贡献者复制/下载。
// ⚠️ id 留空待人工填写，格式 {country}-{city拼音}-{slug}。
export function draftToMarkdown(d: RestaurantDraft): string {
  const lines: string[] = ['---']
  lines.push('id: ""  # 待人工填写，格式 {country}-{city拼音}-{slug}')
  lines.push(`name: "${escapeYaml(d.name)}"`)
  if (d.city) lines.push(`city: "${escapeYaml(d.city)}"`)
  lines.push(`country: "${d.country ?? 'cn'}"`)
  lines.push(`cuisine: "${escapeYaml(d.cuisine)}"`)
  lines.push(`price_level: ${d.price_level}`)
  lines.push(`status: "${d.status}"`)
  if (d.tags?.length) lines.push(`tags: [${d.tags.map((t) => `"${escapeYaml(t)}"`).join(', ')}]`)
  if (d.address) lines.push(`address: "${escapeYaml(d.address)}"`)
  if (d.phone) lines.push(`phone: "${d.phone}"`)
  if (d.notes) lines.push(`notes: "${escapeYaml(d.notes)}"`)
  if (d.description) lines.push(`description: "${escapeYaml(d.description)}"`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${d.name}`)
  lines.push('')
  if (d.description) lines.push(d.description)
  return lines.join('\n')
}

// YAML 字符串转义：双引号、反斜杠、换行。
function escapeYaml(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}

// 生成下载文件名：<店名拼音或slug>.md，这里简单用 name 去空格。
export function draftFileName(d: RestaurantDraft): string {
  const base = d.name.trim().replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() || 'restaurant'
  return `${base}.md`
}
