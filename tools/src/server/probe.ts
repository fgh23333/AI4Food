import type { DataLoader } from './loader'
import type { LlmClient } from './ai/llm'
import { recommend } from './ai/recommend'
import { enumsFromEntries } from './ai/retrieve'
import type { TraceContext } from './observability/tracer'

// 固定探针 query 集：覆盖数据集主要菜系，用于持续监控推荐可用性/稳定性
export const PROBE_QUERIES = [
  '推荐上海本帮菜',
  '上海有什么火锅推荐',
  '上海日料推荐',
  '粤菜推荐',
  '淮扬菜推荐',
] as const

export interface ProbeQuery {
  q: string
  picks: number
  empty: boolean
  ms: number
  err?: string
}

export interface ProbeEntry {
  ts: number
  model: string
  queries: ProbeQuery[]
}

export interface ProbeHistory {
  entries: ProbeEntry[]
}

export const PROBE_HISTORY_KEY = 'probe-history'
const PROBE_MAX = 168 // 7 天 × 24 小时

// KV 存储契约：读 json + 写字符串（KVNamespace 满足）
export interface ProbeStore {
  get(key: string, type: 'json'): Promise<unknown | null>
  put(key: string, value: string): Promise<void>
}

// 环形追加：新 entry 加末尾，超 max 截断最旧（纯函数，可测）
export function appendProbe(history: ProbeHistory | null, entry: ProbeEntry, max = PROBE_MAX): ProbeHistory {
  const entries = [...(history?.entries ?? []), entry]
  return { entries: entries.slice(-max) }
}

// 计算最近一次探针的非空率（健康度，0-1）。无历史返回 null。
export function healthRate(history: ProbeHistory | null): number | null {
  const last = history?.entries[history.entries.length - 1]
  if (!last || last.queries.length === 0) return null
  const nonEmpty = last.queries.filter((q) => !q.empty).length
  return nonEmpty / last.queries.length
}

// 跑一轮探针：对每个 query 调 recommend 记录 picks/空/延迟/错误，追加写回 KV。
export async function runProbe(
  loader: DataLoader,
  llm: LlmClient | undefined,
  store: ProbeStore,
  ctx?: TraceContext,
): Promise<ProbeEntry> {
  const all = await loader.loadAll()
  const enums = enumsFromEntries(all)
  const queries: ProbeQuery[] = []
  let model = 'unknown'

  for (const q of PROBE_QUERIES) {
    const start = Date.now()
    if (!llm) {
      queries.push({ q, picks: 0, empty: true, ms: Date.now() - start, err: 'no llm' })
      continue
    }
    try {
      const result = await recommend(q, all, enums, llm, ctx)
      model = result.model
      queries.push({ q, picks: result.picks.length, empty: result.picks.length === 0, ms: Date.now() - start })
    } catch (e) {
      queries.push({ q, picks: 0, empty: true, ms: Date.now() - start, err: e instanceof Error ? e.message : 'fail' })
    }
  }

  const entry: ProbeEntry = { ts: Date.now(), model, queries }

  // 读旧 history → 追加 → 写回
  const raw = await store.get(PROBE_HISTORY_KEY, 'json')
  const history = appendProbe((raw as ProbeHistory | null) ?? null, entry)
  await store.put(PROBE_HISTORY_KEY, JSON.stringify(history))

  const rate = healthRate(history)
  ctx?.event({
    type: 'probe',
    route: 'scheduled',
    ok: true,
    detail: { model, emptyRate: rate !== null ? 1 - rate : null, queries: queries.length },
  })

  return entry
}
