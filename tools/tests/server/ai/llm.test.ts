import { describe, it, expect } from 'vitest'
import { parseJsonResponse, LlmResponseError } from '../../../src/server/ai/llm'

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
