import type { RestaurantEntry } from '@/types/restaurant'
import { escapeYaml } from './draft'
import { REPO } from './repo'

export function buildClosedMarkdown(entry: RestaurantEntry, reason?: string): string {
  const lines: string[] = ['---']

  lines.push(`id: "${escapeYaml(entry.id)}"`)
  lines.push(`name: "${escapeYaml(entry.name)}"`)
  if (entry.city) lines.push(`city: "${escapeYaml(entry.city)}"`)
  lines.push(`country: "${escapeYaml(entry.country)}"`)
  lines.push(`cuisine: "${escapeYaml(entry.cuisine)}"`)
  lines.push(`price_level: ${entry.price_level}`)
  lines.push('status: closed')

  if (entry.address) lines.push(`address: "${escapeYaml(entry.address)}"`)
  if (entry.latitude !== undefined) lines.push(`latitude: ${entry.latitude}`)
  if (entry.longitude !== undefined) lines.push(`longitude: ${entry.longitude}`)
  if (entry.phone) lines.push(`phone: "${escapeYaml(entry.phone)}"`)

  if (entry.opening_hours && Object.keys(entry.opening_hours).length > 0) {
    lines.push('opening_hours:')
    for (const [day, hours] of Object.entries(entry.opening_hours)) {
      lines.push(`  ${day}: "${escapeYaml(hours)}"`)
    }
  }

  const tags = entry.tags ? [...entry.tags] : []
  if (!tags.includes('已关店')) tags.push('已关店')
  lines.push(`tags: [${tags.map((t) => `"${escapeYaml(t)}"`).join(', ')}]`)

  if (entry.rating !== undefined) lines.push(`rating: ${entry.rating}`)

  if (entry.recommendations && entry.recommendations.length > 0) {
    lines.push('recommendations:')
    for (const rec of entry.recommendations) {
      lines.push(`  - name: "${escapeYaml(rec.name)}"`)
      if (rec.note) lines.push(`    note: "${escapeYaml(rec.note)}"`)
    }
  }

  let notes = entry.notes
  if (reason) {
    if (notes) {
      notes = `${notes}\n关店原因：${reason}`
    } else {
      notes = `关店原因：${reason}`
    }
  }
  if (notes) lines.push(`notes: "${escapeYaml(notes)}"`)

  if (entry.updated_at) lines.push(`updated_at: "${escapeYaml(entry.updated_at)}"`)

  lines.push('---')
  lines.push('')
  lines.push(`# ${entry.name}（已关闭）`)
  lines.push('')
  if (entry.description) {
    lines.push(entry.description)
    lines.push('')
  }

  return lines.join('\n')
}

export function buildGithubEditUrl(entry: RestaurantEntry, newContent: string): string {
  return `${REPO}/edit/main/${entry.path}?value=${encodeURIComponent(newContent)}`
}
