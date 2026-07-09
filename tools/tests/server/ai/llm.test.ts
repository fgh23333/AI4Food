import { describe, it, expect } from 'vitest'
import { parseJsonResponse, LlmResponseError, createWorkerLlm, type AiBinding } from '../../../src/server/ai/llm'

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
