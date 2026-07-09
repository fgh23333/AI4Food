import type { RecommendResponse, DraftResponse } from '@/types/ai'

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
