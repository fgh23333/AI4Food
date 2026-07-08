export function statusLabel(s?: string): string {
  const m: Record<string, string> = { open: '营业中', closed: '已关闭', relocated: '已搬迁', demolished: '已拆除' }
  return (s && m[s]) || s || ''
}
