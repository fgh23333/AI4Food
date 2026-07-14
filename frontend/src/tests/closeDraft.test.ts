import { describe, it, expect } from 'vitest'
import { buildClosedMarkdown, buildGithubEditUrl } from '@/lib/closeDraft'
import type { RestaurantEntry } from '@/types/restaurant'

const entry = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试店', city: '上海', country: 'cn', cuisine: '本帮菜',
  price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md', ...over,
})

describe('buildClosedMarkdown', () => {
  it('status 改 closed，tags 追加已关店，标题加（已关闭）', () => {
    const md = buildClosedMarkdown(entry({ tags: ['本帮'] }), '搬迁')
    expect(md).toContain('status: closed')
    expect(md).toContain('已关店')
    expect(md).toContain('# 测试店（已关闭）')
  })
  it('原 tags 已含已关店时不重复追加', () => {
    const md = buildClosedMarkdown(entry({ tags: ['本帮', '已关店'] }))
    expect(md.match(/已关店/g)?.length).toBe(1)
  })
  it('reason 写入 notes', () => {
    const md = buildClosedMarkdown(entry(), '用户反馈已关')
    expect(md).toContain('用户反馈已关')
  })
  it('description 不写入 frontmatter，作为正文保留（schema additionalProperties:false）', () => {
    const md = buildClosedMarkdown(entry({ description: '这是探店正文。' }))
    const fm = md.slice(0, md.indexOf('\n---', 4))
    expect(fm).not.toContain('description:')
    expect(md).toContain('这是探店正文。')
  })
})

describe('buildGithubEditUrl', () => {
  it('拼出 edit 端点并编码 value', () => {
    const url = buildGithubEditUrl(entry(), '# 测试\n')
    expect(url.startsWith('https://github.com/fgh23333/AI4Food/edit/main/data/restaurants/cn/shanghai/x.md?value=')).toBe(true)
    expect(url).toContain(encodeURIComponent('# 测试\n'))
  })
})
