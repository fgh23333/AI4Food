// LLM 调用封装。抽象出 LlmClient 接口，便于测试注入 mock；
// Worker 实现用 env.AI.run + AI Gateway（缓存与限流）。

// 主力模型：通义千问 Qwen3-30b MoE，中文菜系理解可靠、成本低（约 29 neurons/次）。
// 备选：@cf/zai-org/glm-4.7-flash（中文更强但略贵）。
export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'
export const GATEWAY_ID = 'eatornot'

export interface LlmInput {
  system: string
  user: string
}

export interface LlmOutput {
  text: string
  model: string
}

// LLM 客户端抽象。测试用 mock 实现，Worker 用 createWorkerLlm。
export interface LlmClient {
  run(input: LlmInput): Promise<LlmOutput>
}

// Worker AI binding 的最小类型（避免直接依赖全局 Ai 类型，便于 Node 侧引用）。
// 注意：response 字段可能是 string（纯文本模型）或已解析的对象（当输出是合法 JSON 时，
// 部分模型如 qwen3-30b 会把 response 解析成对象），运行时需做归一化。
export interface AiBinding {
  run(
    model: string,
    input: { messages: { role: string; content: string }[] },
    options?: { gateway?: { id: string; skipCache?: boolean; cacheTtl?: number } },
  ): Promise<{ response?: unknown; result?: { response?: unknown } }>
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
      return { text, model: MODEL }
    },
  }
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
