import { describe, it, expect } from 'vitest'
import {
  CUISINES,
  STATUSES,
  PRICE_LEVELS,
  draftWarnings,
  tagsToString,
  parseTags,
  draftToMarkdown,
  draftFileName,
} from '@/lib/draft'
import type { RestaurantDraft } from '@/types/ai'

const mk = (over: Partial<RestaurantDraft> = {}): RestaurantDraft => ({
  name: '测试店',
  cuisine: '本帮菜',
  price_level: 3,
  status: 'open',
  ...over,
})

describe('枚举常量', () => {
  it('CUISINES 含本帮菜与其他', () => {
    expect(CUISINES).toContain('本帮菜')
    expect(CUISINES).toContain('其他')
  })
  it('STATUSES 含 open/closed/relocated/demolished', () => {
    expect([...STATUSES]).toEqual(['open', 'closed', 'relocated', 'demolished'])
  })
  it('PRICE_LEVELS 为 1-5', () => {
    expect([...PRICE_LEVELS]).toEqual([1, 2, 3, 4, 5])
  })
})

describe('draftWarnings', () => {
  it('字段齐全时无 warning', () => {
    expect(draftWarnings(mk({ name: 'A', address: '路', phone: '021-1' }))).toEqual([])
  })
  it('缺地址/电话时各出 warning', () => {
    const w = draftWarnings(mk({ name: 'A', address: '', phone: '' }))
    expect(w).toContain('地址（address）未提供，需人工补充')
    expect(w).toContain('电话（phone）未提供，需人工补充')
  })
  it('店名为空时出 warning', () => {
    expect(draftWarnings(mk({ name: '' }))).toContain('店名（name）为空')
  })
})

describe('tags 转换', () => {
  it('数组转字符串', () => {
    expect(tagsToString(['火锅', '连锁'])).toBe('火锅, 连锁')
    expect(tagsToString(undefined)).toBe('')
    expect(tagsToString([])).toBe('')
  })
  it('字符串转数组（支持中英文逗号、顿号）', () => {
    expect(parseTags('火锅, 连锁')).toEqual(['火锅', '连锁'])
    expect(parseTags('火锅，连锁、静安')).toEqual(['火锅', '连锁', '静安'])
    expect(parseTags('  ')).toEqual([])
  })
})

describe('draftToMarkdown', () => {
  it('生成合法 frontmatter + 正文', () => {
    const md = draftToMarkdown(mk({ name: 'A店', tags: ['火锅', '连锁'], address: '南京路', phone: '021-1', notes: '好店', description: '探店正文' }))
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('id: ""  # 待人工填写')
    expect(md).toContain('name: "A店"')
    expect(md).toContain('cuisine: "本帮菜"')
    expect(md).toContain('price_level: 3')
    expect(md).toContain('tags: ["火锅", "连锁"]')
    expect(md).toContain('address: "南京路"')
    expect(md).toContain('# A店')
    expect(md).toContain('探店正文')
  })
  it('双引号在值中被转义', () => {
    const md = draftToMarkdown(mk({ name: '带"引号"的店', address: '路' }))
    expect(md).toContain('name: "带\\"引号\\"的店"')
  })
  it('无可选字段时不输出该行', () => {
    const md = draftToMarkdown(mk())
    expect(md).not.toContain('tags:')
    expect(md).not.toContain('address:')
    expect(md).not.toContain('phone:')
  })
  it('country 默认 cn', () => {
    const md = draftToMarkdown(mk({ country: undefined }))
    expect(md).toContain('country: "cn"')
  })
})

describe('draftFileName', () => {
  it('店名转文件名（去空格、小写）', () => {
    expect(draftFileName(mk({ name: '大马可' }))).toBe('大马可.md')
    expect(draftFileName(mk({ name: 'PS. Cafe!' }))).toBe('pscafe.md')
  })
  it('空店名兜底', () => {
    expect(draftFileName(mk({ name: '   ' }))).toBe('restaurant.md')
  })
})
