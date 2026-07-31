// LLM 调用封装。抽象出 LlmClient 接口，便于测试注入 mock；
// Worker 实现用 env.AI.run + AI Gateway（缓存与限流）。

// 主力模型：通义千问 Qwen3-30b MoE，中文菜系理解可靠、成本低（约 29 neurons/次）。
// 备选：@cf/zai-org/glm-4.7-flash（中文更强但略贵）。
export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'
export const GATEWAY_ID = 'default'

export interface LlmInput {
  system: string
  user: string
}

export interface LlmOutput {
  text: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

// LLM 客户端抽象。测试用 mock 实现，Worker 用 createWorkerLlm。
export interface LlmClient {
  run(input: LlmInput): Promise<LlmOutput>
  // 可选流式实现：返回 token 文本流（已剥离 SSE/JSON 包装）。本地 Node 模式无此能力。
  streamRun?(input: LlmInput): Promise<ReadableStream<string>>
}

// Worker AI binding 的最小类型（避免直接依赖全局 Ai 类型，便于 Node 侧引用）。
// 注意：response 字段可能是 string（纯文本模型）或已解析的对象（当输出是合法 JSON 时，
// 部分模型如 qwen3-30b 会把 response 解析成对象），运行时需做归一化。
export interface AiBinding {
  run(
    model: string,
    input: { messages: { role: string; content: string }[]; stream?: boolean },
    options?: { gateway?: { id: string; skipCache?: boolean; cacheTtl?: number } },
  ): Promise<{ response?: unknown; result?: { response?: unknown }; usage?: { prompt_tokens?: number; completion_tokens?: number } }>
}

// 把 AI binding 返回的 response（string 或对象）归一化为字符串。
// 对象时 JSON.stringify，以便下游 parseJsonResponse 统一处理。
function normalizeResponse(value: unknown): string {
  if (typeof value === 'string') return value
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return ''
}

// Worker 实现：env.AI.run 经 AI Gateway。
export function createWorkerLlm(ai: AiBinding, gatewayId = GATEWAY_ID): LlmClient {
  return {
    async run(input) {
      const resp = await ai.run(
        MODEL,
        {
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        },
        { gateway: { id: gatewayId, skipCache: false, cacheTtl: 300 } },
      )
      // Workers AI 文本生成返回 { response } 或 { result: { response } }。
      // response 可能是字符串或对象（见 AiBinding 注释），统一归一化为字符串。
      const raw = resp.response ?? resp.result?.response
      const text = normalizeResponse(raw)
      const usage = resp.usage
        ? { promptTokens: resp.usage.prompt_tokens, completionTokens: resp.usage.completion_tokens }
        : undefined
      return { text, model: MODEL, usage }
    },

    // 流式：stream:true 时 ai.run 返回 ReadableStream<Uint8Array>（SSE/NDJSON 字节）。
    // 这里把它转成已剥离包装的 token 文本流（每个 enqueue 是一个 token 字符串）。
    async streamRun(input) {
      const resp = await ai.run(
        MODEL,
        {
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
          stream: true,
        },
        { gateway: { id: gatewayId, skipCache: false, cacheTtl: 300 } },
      )
      const rawStream = resp as unknown as ReadableStream<Uint8Array>
      const decoder = new TextDecoder()
      const reader = rawStream.getReader()
      return new ReadableStream<string>({
        async start(controller) {
          let buffer = ''
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              // 按 SSE 行边界切；兼容 data: 前缀（SSE）与无前缀（NDJSON）两种风格
              const lines = buffer.split('\n')
              buffer = lines.pop() ?? ''
              for (const line of lines) {
                const token = tokenFromLine(line)
                if (token !== null) controller.enqueue(token)
              }
            }
            // flush 残留
            const token = tokenFromLine(buffer)
            if (token !== null) controller.enqueue(token)
          } finally {
            reader.releaseLock()
            controller.close()
          }
        },
      })
    },
  }
}

// 从单行（SSE data: 行 或 NDJSON 行）提取 token 文本。非数据行/解析失败返回 null。
function tokenFromLine(line: string): string | null {
  let data = line.trim()
  if (!data || data.startsWith('event:')) return null
  if (data.startsWith('data:')) data = data.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    return extractToken(JSON.parse(data))
  } catch {
    return null
  }
}

// 从单个 stream chunk（已 JSON.parse 的对象）提取 token 文本。
// 兼容 binding { response } 与 OpenAI/chat-completion { choices[].delta.content } 两种风格。
export function extractToken(obj: unknown): string | null {
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  if (typeof o.response === 'string') return o.response
  const choices = o.choices
  if (Array.isArray(choices) && choices[0] !== null && typeof choices[0] === 'object') {
    const delta = (choices[0] as Record<string, unknown>).delta
    if (delta !== null && typeof delta === 'object') {
      const content = (delta as Record<string, unknown>).content
      if (typeof content === 'string') return content
    }
  }
  return null
}

// LLM 响应不是合法 JSON 时抛出。
export class LlmResponseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message)
    this.name = 'LlmResponseError'
  }
}

// 从 LLM 文本输出中提取 JSON。
// 兼容：纯 JSON、markdown code fence（```json ... ```）、前后有说明文字。
export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim()
  // 1. 直接尝试整体解析
  try {
    return JSON.parse(trimmed)
  } catch {
    // 继续
  }
  // 2. 提取 code fence 里的内容
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // 继续
    }
  }
  // 3. 提取第一个 { 到最后一个 }（或 [ 到 ]）
  const objStart = trimmed.indexOf('{')
  const objEnd = trimmed.lastIndexOf('}')
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(trimmed.slice(objStart, objEnd + 1))
    } catch {
      // 继续
    }
  }
  const arrStart = trimmed.indexOf('[')
  const arrEnd = trimmed.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(trimmed.slice(arrStart, arrEnd + 1))
    } catch {
      // 继续
    }
  }
  throw new LlmResponseError('LLM 响应无法解析为 JSON', text)
}
