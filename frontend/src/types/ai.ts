// ⚠️ 与 tools/src/types.ts 的 RecommendResponse / DraftResponse 保持一致。
// 后端 hono.ts 返回这两个结构，前端按此解析。

export interface RecommendPick {
  id: string
  name?: string
  reason: string
  score: number
}

export interface RecommendResponse {
  answer: string
  picks: RecommendPick[]
  candidates_considered: number
  model: string
}

// 流式推荐事件（SSE）。answer_chunk 推送 answer 增量，result 收尾给完整结果。
export type RecommendStreamEvent =
  | { type: 'answer_chunk'; data: { text: string } }
  | { type: 'result'; data: RecommendResponse }
  | { type: 'error'; data: { message: string } }

export interface RestaurantDraft {
  name: string
  city?: string
  country?: string
  cuisine: string
  price_level: number
  status: string
  tags?: string[]
  address?: string
  phone?: string
  notes?: string
  description?: string
}

export interface DraftResponse {
  draft: RestaurantDraft
  warnings: string[]
  model: string
}
