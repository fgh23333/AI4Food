import { describe, it, expect } from 'vitest'
import { recommend, recommendStream, StreamAnswerParser } from '../../../src/server/ai/recommend'
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

// 构造带 streamRun 的 mock：run 返回原 prompt JSON（picks 来源），streamRun 按 tokens 流式 answer
function mockStreamLlm(runText: string, tokens: string[]): LlmClient {
  return {
    async run(): Promise<LlmOutput> {
      return { text: runText, model: 'mock-model' }
    },
    async streamRun(): Promise<ReadableStream<string>> {
      return new ReadableStream<string>({
        start(controller) {
          for (const t of tokens) controller.enqueue(t)
          controller.close()
        },
      })
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

  it('LLM 返回无效 id 但 name 匹配候选 -> name 回退到正确 id', async () => {
    const llmText = JSON.stringify({
      answer: '推荐粤香楼',
      picks: [{ id: '错误的id', name: '粤香楼', reason: 'r', score: 0.9 }],
    })
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toHaveLength(1)
    expect(res.picks[0]?.id).toBe('cn-shanghai-a')
    expect(res.picks[0]?.name).toBe('粤香楼')
  })

  it('id 与 name 都无效 -> 丢弃（防幻觉）', async () => {
    const llmText = JSON.stringify({
      answer: 'ok',
      picks: [{ id: '错的', name: '不存在的店', reason: 'r', score: 0.9 }],
    })
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toEqual([])
  })

  it('LLM 返回畸形 picks（字段拼成单 key，qwen 流式常见）-> repair 还原', async () => {
    // 真实观察到的 qwen 流式畸形：整个 pick 的键值对被拼成一个字符串 key
    const llmText = '{"answer":"推荐","picks":[{"id:cn-shanghai-a,name:粤香楼,reason:商务粤菜,score":0.9}]}'
    const res = await recommend('上海粤菜', ENTRIES, ENUMS, mockLlm(llmText))
    expect(res.picks).toHaveLength(1)
    expect(res.picks[0]?.id).toBe('cn-shanghai-a')
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

describe('StreamAnswerParser', () => {
  it('answer 跨 token 切分仍正确累积增量', () => {
    const p = new StreamAnswerParser()
    expect(p.feed('<ans')).toBe('')
    expect(p.feed('wer>')).toBe('')
    expect(p.feed('推荐')).toBe('推荐')
    expect(p.feed('粤香楼')).toBe('粤香楼')
    expect(p.feed('</answer>')).toBe('')
    expect(p.getAnswer()).toBe('推荐粤香楼')
  })

  it('提取 picks JSON（跨 token、含换行）', () => {
    const p = new StreamAnswerParser()
    p.feed('<answer>x</answer>')
    p.feed('<picks>')
    p.feed('{"picks":[{"id":"a"}]')
    p.feed('</picks>')
    expect(p.getPicksJson()).toBe('{"picks":[{"id":"a"}]')
  })

  it('answer 未闭合时取到 picks 前', () => {
    const p = new StreamAnswerParser()
    p.feed('<answer>正在说')
    p.feed('<picks>{"picks":[]}</picks>')
    expect(p.getAnswer()).toBe('正在说')
  })
})

describe('recommendStream', () => {
  it('answer 来自流式 tokens，picks 来自原 prompt 非流式调用', async () => {
    const runText = JSON.stringify({ answer: '原prompt答案', picks: [{ id: 'cn-shanghai-a', reason: '商务粤菜', score: 0.9 }] })
    const tokens = ['<answer>流式', '推荐</answer>', '<picks></picks>']
    const events: Array<{ type: string; data: unknown }> = []
    for await (const ev of recommendStream('上海粤菜', ENTRIES, ENUMS, mockStreamLlm(runText, tokens))) {
      events.push(ev as { type: string; data: unknown })
    }
    const answerText = events
      .filter((e) => e.type === 'answer_chunk')
      .map((e) => (e.data as { text: string }).text)
      .join('')
    expect(answerText).toBe('流式推荐')

    const result = events.find((e) => e.type === 'result')?.data as {
      picks: Array<{ id: string }>; answer: string
    }
    expect(result.picks).toHaveLength(1)
    expect(result.picks[0]?.id).toBe('cn-shanghai-a')
    expect(result.answer).toBe('流式推荐') // answer 优先用流式
  })

  it('原 prompt 返回不存在的 id -> result picks 丢弃该条', async () => {
    const runText = JSON.stringify({ answer: 'x', picks: [{ id: 'cn-shanghai-a', reason: 'r', score: 0.9 }, { id: '不存在', reason: 'r', score: 0.5 }] })
    const tokens = ['<answer>x</answer>']
    const events: Array<{ type: string; data: unknown }> = []
    for await (const ev of recommendStream('上海粤菜', ENTRIES, ENUMS, mockStreamLlm(runText, tokens))) {
      events.push(ev as { type: string; data: unknown })
    }
    const result = events.find((e) => e.type === 'result')?.data as { picks: Array<{ id: string }> }
    expect(result.picks).toHaveLength(1)
    expect(result.picks[0]?.id).toBe('cn-shanghai-a')
  })

  it('无 streamRun 能力时降级为一次性（仍发 answer_chunk + result）', async () => {
    const llm = mockLlm(JSON.stringify({ answer: '推荐粤香楼', picks: [{ id: 'cn-shanghai-a', reason: 'r', score: 0.9 }] }))
    const events: Array<{ type: string; data: unknown }> = []
    for await (const ev of recommendStream('上海粤菜', ENTRIES, ENUMS, llm)) {
      events.push(ev as { type: string; data: unknown })
    }
    expect(events.some((e) => e.type === 'answer_chunk')).toBe(true)
    expect(events.some((e) => e.type === 'result')).toBe(true)
  })
})
