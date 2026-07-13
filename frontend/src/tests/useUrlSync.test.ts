import { describe, it, expect } from 'vitest'
import { encodeFilters, decodeFilters } from '@/composables/useUrlSync'

describe('encode/decode 往返', () => {
  it('全字段往返一致', () => {
    const f = { q: '火锅', cuisine: '川菜', price: 2, open: false, merge: true }
    expect(decodeFilters(encodeFilters(f))).toEqual(f)
  })
  it('open/merge 为默认 true 时不写进 URL', () => {
    const s = encodeFilters({ q: '', cuisine: '', price: 0, open: true, merge: true })
    expect(s.toString()).toBe('')
  })
  it('空 URL 解码出空（无字段）', () => {
    expect(decodeFilters(new URLSearchParams())).toEqual({})
  })
  it('open=0 解码为 false', () => {
    expect(decodeFilters(new URLSearchParams('open=0')).open).toBe(false)
  })
})
