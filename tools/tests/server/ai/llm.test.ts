import { describe, it, expect } from 'vitest'
import { parseJsonResponse, LlmResponseError, createWorkerLlm, extractToken, type AiBinding } from '../../../src/server/ai/llm'

describe('parseJsonResponse', () => {
  it('解析纯 JSON 对象', () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 })
  })

  it('解析纯 JSON 数组', () => {
    expect(parseJsonResponse('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('解析 code fence 包裹的 JSON', () => {
    const text = '好的，结果是：\n```json\n{"answer":"hi","picks":[]}\n```'
    expect(parseJsonResponse(text)).toEqual({ answer: 'hi', picks: [] })
  })

  it('解析无语言标记的 code fence', () => {
    const text = '```\n{"x":1}\n```'
    expect(parseJsonResponse(text)).toEqual({ x: 1 })
  })

  it('解析前后有说明文字的 JSON', () => {
    const text = '这是推荐：{"a":1} 希望你喜欢'
    expect(parseJsonResponse(text)).toEqual({ a: 1 })
  })

  it('无法解析时抛 LlmResponseError', () => {
    expect(() => parseJsonResponse('这不是 JSON')).toThrow(LlmResponseError)
  })

  it('LlmResponseError 保留原始文本', () => {
    try {
      parseJsonResponse('乱七八糟')
    } catch (e) {
      expect(e).toBeInstanceOf(LlmResponseError)
      expect((e as LlmResponseError).raw).toBe('乱七八糟')
    }
  })
})

describe('createWorkerLlm', () => {
  // Workers AI binding 的最小 mock
  function mockAi(returns: unknown): AiBinding {
    return {
      async run() {
        return returns as { response?: string; result?: { response?: string } }
      },
    }
  }

  it('response 为字符串时直接返回', async () => {
    const llm = createWorkerLlm(mockAi({ response: '{"answer":"hi"}' }))
    const out = await llm.run({ system: 's', user: 'u' })
    expect(out.text).toBe('{"answer":"hi"}')
    expect(parseJsonResponse(out.text)).toEqual({ answer: 'hi' })
  })

  it('response 为对象（部分模型把合法 JSON 输出解析成对象）时序列化为字符串', async () => {
    // qwen3-30b 等模型当输出是合法 JSON 时，env.AI.run 返回的 response 字段是对象而非字符串。
    // 若不处理，parseJsonResponse(text) 会因 text.trim is not a function 抛 TypeError（生产 500 根因）。
    const llm = createWorkerLlm(mockAi({ response: { answer: 'hi', picks: [] } }))
    const out = await llm.run({ system: 's', user: 'u' })
    expect(typeof out.text).toBe('string')
    expect(parseJsonResponse(out.text)).toEqual({ answer: 'hi', picks: [] })
  })

  it('response 缺失但 result.response 为字符串时返回', async () => {
    const llm = createWorkerLlm(mockAi({ result: { response: '{"a":1}' } }))
    const out = await llm.run({ system: 's', user: 'u' })
    expect(out.text).toBe('{"a":1}')
  })

  it('response 为对象且无 choices 时仍可序列化', async () => {
    const llm = createWorkerLlm(mockAi({ response: { ok: true } }))
    const out = await llm.run({ system: 's', user: 'u' })
    expect(parseJsonResponse(out.text)).toEqual({ ok: true })
  })
})

describe('createWorkerLlm trace', () => {
  it('ai.run 返回 usage 时 LlmOutput 携带 promptTokens', async () => {
    const ai: AiBinding = { async run() { return { response: '{"a":1}', usage: { prompt_tokens: 42 } } as never } }
    const out = await createWorkerLlm(ai).run({ system: 's', user: 'u' })
    expect(out.usage?.promptTokens).toBe(42)
  })
  it('无 usage 时 usage 为 undefined', async () => {
    const ai: AiBinding = { async run() { return { response: '{}' } } }
    const out = await createWorkerLlm(ai).run({ system: 's', user: 'u' })
    expect(out.usage).toBeUndefined()
  })
})

describe('extractToken', () => {
  it('binding 风格 { response } 提取 token', () => {
    expect(extractToken({ response: '你好' })).toBe('你好')
  })

  it('OpenAI/chat-completion 风格 choices[].delta.content 提取 token', () => {
    expect(extractToken({ choices: [{ delta: { content: '世界' } }] })).toBe('世界')
  })

  it('空 response 字符串返回空串（仍视为有效 token）', () => {
    expect(extractToken({ response: '' })).toBe('')
  })

  it('非对象 / 无已知字段返回 null', () => {
    expect(extractToken(null)).toBeNull()
    expect(extractToken('str')).toBeNull()
    expect(extractToken({ foo: 'bar' })).toBeNull()
    expect(extractToken({ choices: [] })).toBeNull()
  })
})
