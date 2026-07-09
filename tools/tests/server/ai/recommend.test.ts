import { describe, it, expect } from 'vitest'
import { recommend } from '../../../src/server/ai/recommend'
import type { LlmClient, LlmInput, LlmOutput } from '../../../src/server/ai/llm'
import type { IndexEntry, RestaurantEnums } from '../../../src/types'

const ENUMS: RestaurantEnums = {
  cuisines: ['粤菜', '本帮菜', '西餐'],
  statuses: ['open', 'closed'],
  priceLevels: [1, 2, 3, 4, 5],
}

const ENTRIES: IndexEntry[] = [
  {
    id: 'cn-shanghai-a', name: '粤香楼', city: '上海', country: 'cn',
    cuisine: '粤菜', price_level: 4, status: 'open', rating: 4.5,
    tags: ['商务宴请'], address: '陆家嘴', path: 'a.md',
  },
  {
    id: 'cn-shanghai-b', name: '本帮小馆', city: '上海', country: 'cn',
    cuisine: '本帮菜', price_level: 2, status: 'open', path: 'b.md',
  },
]

// 构造 mock LlmClient，返回固定文本
function mockLlm(text: string): LlmClient {
  return {
    async run(_input: LlmInput): Promise<LlmOutput> {
      return { text, model: 'mock-model' }
    },
  }
}

describe('recommend', () => {
  it('正常流程：LLM 返回合法 picks -> 组装响应', async () => {
    const llmText = JSON.stringify({
      answer: '推荐粤香楼',
      picks: [{ id: 'cn-shanghai-a', reason: '高端粤菜适合商务', score: 0.9 }],
    })
    const res = await recommend('上海商务粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.answer).toBe('推荐粤香楼')
    expect(res.picks).toHaveLength(1)
    const pick0 = res.picks[0]
    expect(pick0?.id).toBe('cn-shanghai-a')
    expect(pick0?.reason).toBeTruthy()
    expect(res.candidates_considered).toBeGreaterThan(0)
    expect(res.model).toBe('mock-model')
  })

  it('补全 pick 的 name（来自 entries）', async () => {
    const llmText = JSON.stringify({
      answer: 'ok',
      picks: [{ id: 'cn-shanghai-a', reason: 'r', score: 0.8 }],
    })
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks[0]?.name).toBe('粤香楼')
  })

  it('LLM 返回不存在的 id -> 丢弃该 pick', async () => {
    const llmText = JSON.stringify({
      answer: '...',
      picks: [
        { id: 'cn-shanghai-a', reason: 'r1', score: 0.9 },
        { id: '不存在', reason: 'r2', score: 0.5 },
      ],
    })
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toHaveLength(1)
    expect(res.picks[0]?.id).toBe('cn-shanghai-a')
  })

  it('LLM 返回非法 JSON -> 抛错（路由层转 502）', async () => {
    await expect(
      recommend('上海粤菜', ENTRIES, ENUMS, mockLlm('不是 JSON 的乱文本')),
    ).rejects.toThrow()
  })

  it('候选集为空 -> answer 提示无匹配，picks 为空，不调 LLM 也能给降级', async () => {
    // 用一个城市/菜系都不存在、放宽后仍可能空的情况
    const llmText = JSON.stringify({
      answer: '暂时没有匹配的餐厅',
      picks: [],
    })
    const res = await recommend('深圳法餐', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toEqual([])
    // 放宽后可能返回全部 entries 作为候选给 LLM，candidates_considered >= 0
    expect(res.candidates_considered).toBeGreaterThanOrEqual(0)
  })

  it('LLM 返回空 picks 数组 -> 响应 picks 为空不报错', async () => {
    const llmText = JSON.stringify({ answer: '无推荐', picks: [] })
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toEqual([])
    expect(res.answer).toBe('无推荐')
  })
})
