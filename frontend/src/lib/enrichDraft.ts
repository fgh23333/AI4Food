import type { RestaurantEntry } from '@/types/restaurant'
import { REPO } from './repo'

export interface FieldGap {
  key: string
  label: string
}

// 缺失字段检测：核心可补全字段。坐标成对校验（缺一即视为缺坐标）。
const CHECKS: ReadonlyArray<{ key: string; label: string; missing: (e: RestaurantEntry) => boolean }> = [
  { key: 'address', label: '地址', missing: (e) => !e.address },
  {
    key: 'coords',
    label: '坐标',
    missing: (e) => typeof e.latitude !== 'number' || typeof e.longitude !== 'number',
  },
  { key: 'phone', label: '电话', missing: (e) => !e.phone },
  {
    key: 'hours',
    label: '营业时间',
    missing: (e) => !e.opening_hours || Object.keys(e.opening_hours).length === 0,
  },
]

export function missingFields(entry: RestaurantEntry): FieldGap[] {
  return CHECKS.filter((c) => c.missing(entry)).map((c) => ({ key: c.key, label: c.label }))
}

// 跳转 GitHub 编辑原文件页（不预填 ?value=，避免覆盖原数据；贡献者在原文基础上补字段）。
export function buildEnrichUrl(entry: RestaurantEntry): string {
  return `${REPO}/edit/main/${entry.path}`
}
