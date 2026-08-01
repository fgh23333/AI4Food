import type { RecommendResponse, DraftResponse, RecommendStreamEvent, ProbeResult } from '@/types/ai'
import type { RestaurantEntry } from '@/types/restaurant'
import type { ListResponse, Meta } from '@/types/api'

// 后端 API 基址。生产部署在 ai4food.635262140.xyz（*.workers.dev 大陆不可达，故用自定义域）。
// 可用 Vite 环境变量 VITE_API_BASE 覆盖（本地联调用 http://localhost:8787）。
const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://ai4food.635262140.xyz'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

// 智能推荐：自然语言提问 -> 候选餐厅推荐。
// 后端路径 POST /api/ai/recommend，见 tools/src/server/hono.ts。
export async function askRecommend(question: string, signal?: AbortSignal): Promise<RecommendResponse> {
  const res = await fetch(`${API_BASE}/api/ai/recommend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })
  if (!res.ok) {
    throw new ApiError(await safeText(res), res.status)
  }
  return (await res.json()) as RecommendResponse
}

// 流式推荐：SSE 推送 answer 增量（onAnswer 回调逐字）+ 收尾 result（返回完整结果含 picks）。
// 解析失败/服务端 error 事件 → 抛 ApiError。
export async function askRecommendStream(
  question: string,
  onAnswer: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<RecommendResponse> {
  const res = await fetch(`${API_BASE}/api/ai/recommend/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })
  if (!res.ok) {
    throw new ApiError(await safeText(res), res.status)
  }
  const body = res.body
  if (!body) throw new ApiError('流式响应无 body', 502)

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: RecommendResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 按空行分帧；这里按行处理（每帧含一个 data: 行）
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data) continue
      try {
        const ev = JSON.parse(data) as RecommendStreamEvent
        if (ev.type === 'answer_chunk') {
          onAnswer(ev.data.text)
        } else if (ev.type === 'result') {
          result = ev.data
        } else if (ev.type === 'error') {
          throw new ApiError(ev.data.message, 502)
        }
      } catch (e) {
        if (e instanceof ApiError) throw e
        // 非 JSON 行忽略
      }
    }
  }

  if (!result) throw new ApiError('流式响应未返回结果', 502)
  return result
}

// AI 辅助贡献：自然语言描述 -> 餐厅 frontmatter 草稿（供人工核对，不直接写入 data/）。
// 后端路径 POST /api/ai/draft，见 tools/src/server/hono.ts。
export async function generateDraft(description: string, signal?: AbortSignal): Promise<DraftResponse> {
  const res = await fetch(`${API_BASE}/api/ai/draft`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description }),
    signal,
  })
  if (!res.ok) {
    throw new ApiError(await safeText(res), res.status)
  }
  return (await res.json()) as DraftResponse
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return `HTTP ${res.status}`
  }
}

// 全量拉取餐厅列表（前端本地筛选/分页，不需要后端分页）。
export async function fetchRestaurants(signal?: AbortSignal): Promise<RestaurantEntry[]> {
  const res = await fetch(`${API_BASE}/api/restaurants?limit=2000`, { signal })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const body = (await res.json()) as ListResponse
  return body.data
}

// 按精确 id 拉取单条餐厅。404 返回 null（调用方自行处理）。
export async function fetchRestaurantById(id: string, signal?: AbortSignal): Promise<RestaurantEntry | null> {
  const res = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(id)}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as RestaurantEntry
}

// 拉取汇总元数据（总数、开放数、城市/菜系/价位列表）。
export async function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta`, { signal })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as Meta
}

// 拉取 AI 探针历史（最近一次健康度 + entries）。失败静默（不影响列表加载）。
export async function fetchProbe(signal?: AbortSignal): Promise<ProbeResult> {
  const res = await fetch(`${API_BASE}/api/probe`, { signal })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as ProbeResult
}
