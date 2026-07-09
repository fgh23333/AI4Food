import { describe, it, expect } from 'vitest'
import { draft } from '../../../src/server/ai/draft'
import type { LlmClient, LlmInput, LlmOutput } from '../../../src/server/ai/llm'
import type { IndexEntry, RestaurantEnums } from '../../../src/types'

const ENUMS: RestaurantEnums = {
  cuisines: ['粤菜', '本帮菜', '西餐', '日料'],
  statuses: ['open', 'closed'],
  priceLevels: [1, 2, 3, 4, 5],
}

const ENTRIES: IndexEntry[] = [
  { id: 'cn-shanghai-existing', name: '已存在店', city: '上海', country: 'cn', cuisine: '粤菜', price_level: 3, status: 'open', path: 'x.md' },
]

function mockLlm(text: string): LlmClient {
  return {
    async run(_input: LlmInput): Promise<LlmOutput> {
      return { text, model: 'mock-model' }
    },
  }
}

describe('draft', () => {
  it('正常流程：LLM 返回合法草稿 -> 组装响应', async () => {
    const llmText = JSON.stringify({
      name: '静安日料',
      cuisine: '日料',
      price_level: 5,
      status: 'open',
      city: '上海',
      country: 'cn',
      tags: ['omakase'],
      address: '静安寺',
      description: '# 静安日料\n\nomakase',
    })
    const res = await draft('静安寺日料omakase人均500', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.draft.name).toBe('静安日料')
    expect(res.draft.cuisine).toBe('日料')
    expect(res.draft.price_level).toBe(5)
    expect(res.model).toBe('mock-model')
  })

  it('cuisine 越界 -> 置默认"其他"并加 warning', async () => {
    const llmText = JSON.stringify({
      name: 'X', cuisine: '法餐', price_level: 3, status: 'open',
    })
    const res = await draft('法餐', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.draft.cuisine).toBe('其他')
    expect(res.warnings.some((w) => w.includes('菜系') || w.includes('cuisine'))).toBe(true)
  })

  it('status 越界 -> 置默认 open 并加 warning', async () => {
    const llmText = JSON.stringify({
      name: 'X', cuisine: '粤菜', price_level: 3, status: '暂停营业',
    })
    const res = await draft('某店', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.draft.status).toBe('open')
    expect(res.warnings.some((w) => w.includes('状态') || w.includes('status'))).toBe(true)
  })

  it('price_level 越界 -> 置默认 3 并加 warning', async () => {
    const llmText = JSON.stringify({
      name: 'X', cuisine: '粤菜', price_level: 9, status: 'open',
    })
    const res = await draft('某店', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.draft.price_level).toBe(3)
    expect(res.warnings.some((w) => w.includes('价位') || w.includes('price'))).toBe(true)
  })

  it('必填字段缺失（address/phone）-> warning 提示', async () => {
    const llmText = JSON.stringify({
      name: 'X', cuisine: '粤菜', price_level: 3, status: 'open',
    })
    const res = await draft('某店', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.warnings.some((w) => w.includes('address') || w.includes('地址'))).toBe(true)
  })

  it('name 缺失 -> warning（name 是必填）', async () => {
    const llmText = JSON.stringify({
      cuisine: '粤菜', price_level: 3, status: 'open',
    })
    const res = await draft('某店', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.warnings.some((w) => w.includes('名称') || w.includes('name'))).toBe(true)
  })

  it('LLM 返回非法 JSON -> 抛错', async () => {
    await expect(
      draft('某店', ENTRIES, ENUMS, mockLlm('乱文本')),
    ).rejects.toThrow()
  })
})
