# 第五期：可观测性 + 体验增强 + API 化 + 推荐优化 + 贡献辅助 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改数据 schema、不改后端路由签名的前提下，给后端加全链路 trace（双通道）、前端数据源改走后端 API、补齐体验（URL 同步/骨架屏/错误边界/空态）、推荐连锁去重、详情页「标记关闭」草稿入口。

**Architecture:** 后端新增公共 `Tracer` 抽象（`observability/tracer.ts`），经 `createApp(loader, llm?, tracer?)` 注入；`console.log`（通道 A，Workers Observability 自动采集）+ Analytics Engine（通道 B，生产长期留存）双发，业务代码只调 `tracer.event()`。前端 `stores/restaurants.ts` 的 `load()` 从读打包 `index.json` 改为 fetch 后端 `/api/restaurants`，体验层新增骨架屏/错误边界/空态/URL 同步组件，推荐去重与关闭草稿为纯函数。

**Tech Stack:** Hono、Cloudflare Workers AI、Analytics Engine、Vue 3 + Pinia + vue-router、Vitest、TypeScript strict。

## Global Constraints

（摘自 spec，每个 task 隐含遵守）

- **数据铁律**：`data/` 只放人类手写数据；前端、AI、trace 均不写 `data/`。「标记关闭」只生成草稿文本 + 跳转 GitHub。
- **trace 数据粒度**：detail 只记候选数/token/解析成败/反幻觉丢弃数/prompt 长度，**不记 prompt 与 LLM 响应全文**（防 blob 超 16KB + 防泄露用户问题）。
- **Trace 不阻塞**：Tracer 内部全 try/catch，writeDataPoint 抛错静默，绝不影响主请求。
- **Analytics Engine binding 本地不可用**：本地（Node server）只走 console.log；B 通道靠类型 + mock 单测保证，生产 `wrangler tail` 实测。
- **类型一致**：前端 `RestaurantEntry`（`frontend/src/types/restaurant.ts`）与后端 `IndexEntry`（`tools/src/types.ts`）字段已对齐，维持不破。
- **TypeScript strict + noUncheckedIndexedAccess**：禁用 `any`；数组下标访问用 `?.` 或显式守卫。
- **TDD**：纯逻辑（tracer 映射、URL 编解码、连锁去重、关闭草稿）先写 Vitest 测试。
- **环境**：Node 22 + pnpm 10，包管理只用 pnpm。
- **后端验证**：`cd tools && pnpm typecheck && pnpm test && pnpm validate` 必须全绿。
- **前端验证**：`cd frontend && pnpm typecheck && pnpm test && pnpm build` 必须全绿。
- **分支**：`feature/frontend-phase5`。**实施切片按模块分 PR**，P0（可观测性）单独先合作为地基，P1-P4 再分 PR。
- **commit**：新能力 `feat:`，修 bug `fix:`，依赖/重构/配置 `chore:`，文档 `docs:`，结尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。

### P0 与后续 PR 切分

- **PR-A（P0 可观测性）**：Task 1-4。先合，作为地基。
- **PR-B（P1 数据源 API 化）**：Task 5-7。
- **PR-C（P2 体验）**：Task 8-11。
- **PR-D（P3 推荐去重）**：Task 12-13。
- **PR-E（P4 标记关闭草稿）**：Task 14-15。

---

## Task 1: Tracer 抽象与 TraceRecord schema

**Files:**
- Create: `tools/src/server/observability/tracer.ts`
- Test: `tools/tests/server/observability/tracer.test.ts`

**Interfaces:**
- Produces:
  - `export interface TraceRecord { type: string; route: string; method?: string; status?: number; durationMs?: number; ok: boolean; detail?: Record<string, unknown> }`
  - `export interface TraceContext { traceId: string; event(record: Omit<TraceRecord, 'traceId'>): void; start(): number; elapsed(start: number): number }`
  - `export interface AnalyticsDataset { writeDataPoint(p: { indexes: string[]; blobs: string[]; doubles: number[] }): void }`
  - `export interface Tracer { begin(route: string, method?: string): TraceContext }`
  - `export function createConsoleTracer(): Tracer`
  - `export function createAnalyticsTracer(dataset: AnalyticsDataset, fallback?: Tracer): Tracer`（binding 缺失时降级到 fallback；fallback 缺省为 console）
  - `export function createDualTracer(tracers: Tracer[]): Tracer`（组合：同一 event 广播给所有 tracer，任一抛错不影响其他）
  - `export const NOOP_TRACER: Tracer`（测试默认，不产生输出）
  - `export function mapRecordToDataPoint(record: TraceRecord & { traceId: string }): { indexes: string[]; blobs: string[]; doubles: number[] }`（纯函数：record → Analytics 字段映射）

**通道映射约定（纯函数 `mapRecordToDataPoint` 实现）**：
- `indexes[0]` = traceId
- `indexes[1]` = type
- `blobs[0]` = route
- `blobs[1]` = method ?? ''
- `blobs[2]` = `JSON.stringify(detail ?? {})`，**截断到 15KB**（防超 16KB 总量上限，留余量给其他 blob）
- `doubles[0]` = ts（epoch ms）
- `doubles[1]` = status ?? 0
- `doubles[2]` = durationMs ?? 0
- `doubles[3]` = ok ? 1 : 0

- [ ] **Step 1: 写失败测试（mapRecordToDataPoint 字段映射）**

```ts
// tools/tests/server/observability/tracer.test.ts
import { describe, it, expect } from 'vitest'
import { mapRecordToDataPoint, createConsoleTracer, createAnalyticsTracer, createDualTracer, NOOP_TRACER, type TraceRecord } from '../../../src/server/observability/tracer'

describe('mapRecordToDataPoint', () => {
  const base = (over: Partial<TraceRecord> = {}): TraceRecord & { traceId: string } => ({
    traceId: 'abcd1234',
    type: 'http',
    route: 'GET /api/meta',
    ok: true,
    ...over,
  })

  it('完整字段映射到 indexes/blobs/doubles', () => {
    const dp = mapRecordToDataPoint(base({ method: 'GET', status: 200, durationMs: 12, detail: { x: 1 } }))
    expect(dp.indexes).toEqual(['abcd1234', 'http'])
    expect(dp.blobs[0]).toBe('GET /api/meta')
    expect(dp.blobs[1]).toBe('GET')
    expect(dp.blobs[2]).toBe('{"x":1}')
    expect(dp.doubles[1]).toBe(200)
    expect(dp.doubles[2]).toBe(12)
    expect(dp.doubles[3]).toBe(1)
  })

  it('缺省 method/status/durationMs 时用空/0 兜底', () => {
    const dp = mapRecordToDataPoint(base({}))
    expect(dp.blobs[1]).toBe('')
    expect(dp.doubles[1]).toBe(0)
    expect(dp.doubles[2]).toBe(0)
  })

  it('detail 缺失时 blobs[2] 为 "{}"', () => {
    const dp = mapRecordToDataPoint(base({ detail: undefined }))
    expect(dp.blobs[2]).toBe('{}')
  })

  it('detail 超大时截断到 15KB', () => {
    const big = { x: '字'.repeat(20000) }
    const dp = mapRecordToDataPoint(base({ detail: big }))
    expect(dp.blobs[2].length).toBeLessThanOrEqual(15360)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd tools && pnpm test -- tracer.test 2>&1 | head -20`
Expected: FAIL（模块不存在，导入报错）

- [ ] **Step 3: 实现 tracer.ts**

```ts
// tools/src/server/observability/tracer.ts
// 全链路 trace：console.log（通道A，Workers Observability 自动采集）+ Analytics Engine（通道B，生产）。
// 业务只调 ctx.event(...)；Tracer 内部全 try/catch，绝不阻塞主请求。

export interface TraceRecord {
  type: string
  route: string
  method?: string
  status?: number
  durationMs?: number
  ok: boolean
  detail?: Record<string, unknown>
}

// Analytics Engine binding 的最小契约（避免引入 workers 全局类型）。
export interface AnalyticsDataset {
  writeDataPoint(p: { indexes: string[]; blobs: string[]; doubles: number[] }): void
}

export interface TraceContext {
  traceId: string
  event(record: Omit<TraceRecord, 'traceId'>): void
  start(): number
  elapsed(start: number): number
}

export interface Tracer {
  begin(route: string, method?: string): TraceContext
}

const MAX_DETAIL_BYTES = 15 * 1024 // 16KB blob 上限留余量

// 纯函数：record → Analytics dataPoint 字段映射。
export function mapRecordToDataPoint(record: TraceRecord & { traceId: string }): {
  indexes: string[]
  blobs: string[]
  doubles: number[]
} {
  const detailStr = truncate(JSON.stringify(record.detail ?? {}), MAX_DETAIL_BYTES)
  return {
    indexes: [record.traceId, record.type],
    blobs: [record.route, record.method ?? '', detailStr],
    doubles: [Date.now(), record.status ?? 0, record.durationMs ?? 0, record.ok ? 1 : 0],
  }
}

function truncate(s: string, maxBytes: number): string {
  // 两端兼容：用 TextEncoder/TextDecoder（Node 19+ 与 Worker 运行时都有）。
  // 不能用 Buffer--Worker 运行时无 Buffer。按 UTF-8 字节截断后 fatal:false decode，
  // 保证截断多字节字符中间时不抛、产出替换字符。
  const bytes = new TextEncoder().encode(s)
  if (bytes.length <= maxBytes) return s
  return new TextDecoder('utf8', { fatal: false }).decode(bytes.subarray(0, maxBytes))
}

function newTraceId(): string {
  // crypto.randomUUID 全平台可用（Node 19+ / Worker）。取前 8 位缩短。
  return (crypto as { randomUUID?: () => string }).randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)
}

export function createConsoleTracer(): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const traceId = newTraceId()
      const start = Date.now()
      return {
        traceId,
        start: () => start,
        elapsed: (s: number) => Date.now() - s,
        event(record) {
          try {
            console.log(JSON.stringify({ traceId, ...record }))
          } catch {
            // 静默
          }
        },
      }
    },
  }
}

export function createAnalyticsTracer(dataset: AnalyticsDataset, fallback: Tracer = createConsoleTracer()): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const ctx = fallback.begin(route, method)
      return {
        ...ctx,
        event(record) {
          ctx.event(record)
          try {
            dataset.writeDataPoint(mapRecordToDataPoint({ traceId: ctx.traceId, ...record }))
          } catch {
            // 静默
          }
        },
      }
    },
  }
}

// 组合 tracer：同一 event 广播给所有子 tracer，任一抛错不影响其他。
export function createDualTracer(tracers: Tracer[]): Tracer {
  return {
    begin(route: string, method?: string): TraceContext {
      const ctxs = tracers.map((t) => t.begin(route, method))
      const traceId = ctxs[0]?.traceId ?? newTraceId()
      return {
        traceId,
        start: () => ctxs[0]?.start() ?? Date.now(),
        elapsed: (s: number) => Date.now() - s,
        event(record) {
          for (const ctx of ctxs) {
            try {
              ctx.event(record)
            } catch {
              // 静默
            }
          }
        },
      }
    },
  }
}

export const NOOP_TRACER: Tracer = {
  begin(_route: string, _method?: string): TraceContext {
    const traceId = newTraceId()
    return {
      traceId,
      start: () => Date.now(),
      elapsed: (s: number) => Date.now() - s,
      event() {
        /* no-op */
      },
    }
  },
}
```


- [ ] **Step 4: 跑测试确认通过**

Run: `cd tools && pnpm test -- tracer.test 2>&1 | head -20`
Expected: PASS（4 个 mapRecordToDataPoint 测试全过）

- [ ] **Step 5: 补 Tracer 行为测试（console/analytics/dual/noop/降级/不抛）**

在 `tracer.test.ts` 追加：
```ts
import { vi } from 'vitest'
import type { AnalyticsDataset, TraceContext } from '../../../src/server/observability/tracer'

describe('createConsoleTracer', () => {
  it('event 打印含 traceId 与 type 的 JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ctx = createConsoleTracer().begin('GET /api/meta', 'GET')
    ctx.event({ type: 'http', route: 'GET /api/meta', ok: true })
    expect(JSON.parse(spy.mock.calls[0]![0] as string).type).toBe('http')
    expect(JSON.parse(spy.mock.calls[0]![0] as string).traceId).toBe(ctx.traceId)
    spy.mockRestore()
  })
})

describe('createAnalyticsTracer', () => {
  it('binding 缺失时降级到 fallback（console）且不抛', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const bad: AnalyticsDataset = { writeDataPoint() { throw new Error('boom') } }
    const ctx = createAnalyticsTracer(bad).begin('r', 'POST')
    expect(() => ctx.event({ type: 'ai_llm', route: 'r', ok: true })).not.toThrow()
    spy.mockRestore()
  })

  it('正常时 console + writeDataPoint 双发', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const dataset: AnalyticsDataset = { writeDataPoint: vi.fn() }
    const ctx = createAnalyticsTracer(dataset, NOOP_TRACER).begin('r', 'POST')
    ctx.event({ type: 'ai_llm', route: 'r', ok: true, detail: { model: 'm' } })
    expect(spy).not.toHaveBeenCalled() // fallback 是 NOOP，故无 console
    expect((dataset.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('createDualTracer', () => {
  it('广播给所有子 tracer，一个抛不影响其他', () => {
    const ok = { writeDataPoint: vi.fn() } as unknown as AnalyticsDataset
    const t1 = createAnalyticsTracer(ok)
    const boom = { writeDataPoint: vi.fn(() => { throw new Error('x') }) } as unknown as AnalyticsDataset
    const t2 = createAnalyticsTracer(boom)
    const dual = createDualTracer([t1, t2])
    expect(() => dual.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
    expect((ok.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: 跑全部 tracer 测试通过**

Run: `cd tools && pnpm test -- tracer.test 2>&1 | tail -10`
Expected: PASS（所有 tracer 测试）

- [ ] **Step 7: typecheck**

Run: `cd tools && pnpm typecheck 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 8: commit**

```bash
git add tools/src/server/observability/tracer.ts tools/tests/server/observability/tracer.test.ts
git commit -m "feat: 新增 Tracer 抽象与 trace 双通道（console + Analytics Engine）"
```

---

## Task 2: hono.ts 注入 Tracer + http 事件中间件

**Files:**
- Modify: `tools/src/server/hono.ts`（`createApp` 签名加可选 `tracer`，默认 NOOP_TRACER；加 `'/api/*'` 中间件记 `http` 事件）
- Test: `tools/tests/server/hono.test.ts`（注入 mock tracer，验证每个路由触发 `http` 事件）

**Interfaces:**
- Consumes: Task 1 的 `Tracer`, `TraceContext`, `NOOP_TRACER`
- Produces: `createApp(loader, llm?, tracer?)`（新增第三可选参数）

- [ ] **Step 1: 写失败测试（http 事件被触发 + traceId 一致）**

在 `hono.test.ts` 顶部新增一个记录型 tracer：
```ts
import { NOOP_TRACER, type Tracer, type TraceRecord } from '../../src/server/observability/tracer'

function recordingTracer(): { tracer: Tracer; events: (TraceRecord & { traceId: string })[] } {
  const events: (TraceRecord & { traceId: string })[] = []
  const tracer: Tracer = {
    begin(route: string, method?: string) {
      const ctx = NOOP_TRACER.begin(route, method)
      return {
        ...ctx,
        event(record) { events.push({ traceId: ctx.traceId, ...record }) },
      }
    },
  }
  return { tracer, events }
}

describe('hono trace（http 事件）', () => {
  it('GET /api/meta 触发 http 事件，status 200，ok true', async () => {
    const { tracer, events } = recordingTracer()
    const app = createApp(fakeLoader(entries), undefined, tracer)
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
    const http = events.find((e) => e.type === 'http')
    expect(http).toBeDefined()
    expect(http!.status).toBe(200)
    expect(http!.ok).toBe(true)
    expect(http!.route).toBe('GET /api/meta')
  })

  it('非法参数返回 400 且记 ok false', async () => {
    const { tracer, events } = recordingTracer()
    const app = createApp(fakeLoader(entries), undefined, tracer)
    await app.request('/api/restaurants?price=9')
    const http = events.find((e) => e.type === 'http')!
    expect(http.status).toBe(400)
    expect(http.ok).toBe(false)
  })

  it('不传 tracer 时不报错（默认 NOOP）', async () => {
    const app = createApp(fakeLoader(entries))
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd tools && pnpm test -- hono.test 2>&1 | grep -E "trace|http 事件" | head`
Expected: FAIL（createApp 不接受第三参数 / 无 http 事件）

- [ ] **Step 3: 改 hono.ts**

在文件头部 import：
```ts
import { NOOP_TRACER, type Tracer } from './observability/tracer'
```

改 `createApp` 签名与加中间件：
```ts
export function createApp(loader: DataLoader, llm?: LlmClient, tracer: Tracer = NOOP_TRACER): Hono {
  const app = new Hono()

  app.use(
    '/api/*',
    cors({ origin: (origin) => corsOrigin(origin ?? ''), allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 86400 }),
  )

  // trace 中间件：记 http 事件（路由/方法/状态码/耗时/成败）。Tracer 内部已容错。
  app.use('/api/*', async (c, next) => {
    const ctx = tracer.begin(`${c.req.method} ${new URL(c.req.url).pathname}`, c.req.method)
    const start = ctx.start()
    await next()
    ctx.event({
      type: 'http',
      route: `${c.req.method} ${new URL(c.req.url).pathname}`,
      method: c.req.method,
      status: c.res.status,
      durationMs: ctx.elapsed(start),
      ok: c.res.status < 400,
    })
  })
  // ... 其余路由不变
```

> 中间件用闭包变量 `ctx` 携带即可，**不写 `c.set('trace', ...)`**（Hono 的 `c.set` 需要泛型类型声明，徒增 strict 抖动）。下方 AI 路由直接用外层闭包变量 `tracer` 各自 `tracer.begin(...)` 开新 ctx（AI 链路有多个子事件，需共享 traceId）。http 中间件 ctx 与 AI 路由 ctx 的 traceId **不强求一致**：http 是请求级出口事件，AI 子事件可独立 traceId，便于按事件类型在 Analytics 里过滤。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd tools && pnpm test -- hono.test 2>&1 | tail -10`
Expected: PASS（含新增 3 个 trace 测试 + 原 18 个全绿）

- [ ] **Step 5: typecheck + validate**

Run: `cd tools && pnpm typecheck && pnpm validate 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 6: commit**

```bash
git add tools/src/server/hono.ts tools/tests/server/hono.test.ts
git commit -m "feat: hono 注入 Tracer，/api/* 路由记 http 事件"
```

---

## Task 3: AI 链路埋点（recommend/draft/llm）

**Files:**
- Modify: `tools/src/server/ai/recommend.ts`（retrieve/llm/parse/result 四处埋点）
- Modify: `tools/src/server/ai/draft.ts`（同结构埋点）
- Modify: `tools/src/server/ai/llm.ts`（`createWorkerLlm` 埋 ai_llm；`LlmClient` run 返回可选 usage）
- Modify: `tools/src/server/hono.ts`（AI 路由内开 ctx 并透传给 recommend/draft）
- Test: `tools/tests/server/ai/llm.test.ts`、`tools/tests/server/hono.test.ts`

**Interfaces:**
- Consumes: Task 1 `TraceContext`
- Produces: `recommend(question, entries, enums, llm, ctx?)` 新增可选 ctx；`draft(...)` 同理；`LlmOutput` 加 `usage?: { promptTokens?: number; completionTokens?: number }`

**埋点 detail 约定（不记全文）**：
- `ai_retrieve`: `{ candidates: number, questionChars: number }`
- `ai_llm`: `{ model: string, promptChars: number, gateway?: string, promptTokens?: number }`
- `ai_parse`: `{ rawChars: number, ok: boolean, error?: string }`
- `ai_result` (recommend): `{ picks: number, dropped: number }`
- `ai_result` (draft): `{ warnings: number, fields: number }`

- [ ] **Step 1: 写失败测试（recommend 链路触发 4 个 ai_* 事件）**

在 `hono.test.ts` 新增（复用 recordingTracer）：
```ts
describe('AI 推荐 trace 链路', () => {
  it('成功推荐触发 ai_retrieve/ai_llm/ai_parse/ai_result', async () => {
    const { tracer, events } = recordingTracer()
    const llm = fakeLlm(JSON.stringify({ answer: '去A店', picks: [{ id: 'cn-shanghai-a', reason: 'r', score: 0.9 }] }))
    const app = createApp(fakeLoader(entries), llm, tracer)
    const res = await app.request('/api/ai/recommend', { method: 'POST', body: JSON.stringify({ question: '上海本帮菜' }) })
    expect(res.status).toBe(200)
    const types = events.map((e) => e.type)
    expect(types).toContain('ai_retrieve')
    expect(types).toContain('ai_llm')
    expect(types).toContain('ai_parse')
    expect(types).toContain('ai_result')
    const result = events.find((e) => e.type === 'ai_result')!
    expect(result.detail).toMatchObject({ picks: 1 })
  })

  it('LLM 返回乱码时 ai_parse 记 ok false', async () => {
    const { tracer, events } = recordingTracer()
    const llm = fakeLlm('这不是JSON')
    const app = createApp(fakeLoader(entries), llm, tracer)
    await app.request('/api/ai/recommend', { method: 'POST', body: JSON.stringify({ question: 'x' }) })
    const p = events.find((e) => e.type === 'ai_parse')!
    expect(p.detail).toMatchObject({ ok: false })
  })
})
```

在 `llm.test.ts` 新增（createWorkerLlm 记 usage）：
```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd tools && pnpm test 2>&1 | grep -E "FAIL|ai_retrieve|promptTokens" | head`
Expected: FAIL（函数未接 ctx / 无 usage）

- [ ] **Step 3: 改 llm.ts（LlmOutput 加 usage + 记录）**

> **self-review 核实**：现有 `LlmOutput` 只有 `{ text, model }`（第 14-17 行），`AiBinding.run` 返回 `{ response?, result? }`（第 27-33 行），`createWorkerLlm.run` 第 59-61 行归一化后返回 `{ text, model }`。本步只在这三处增量加 `usage`，不动 `normalizeResponse` 与 gateway 逻辑。`GATEWAY_ID` 已 export（第 7 行），recommend 埋点直接用它而非硬编码。

```ts
// LlmOutput 加可选 usage
export interface LlmOutput {
  text: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

// AiBinding.run 返回加可选 usage（Workers AI 文本生成会回带 usage.{prompt_tokens,completion_tokens}）
export interface AiBinding {
  run(
    model: string,
    input: { messages: { role: string; content: string }[] },
    options?: { gateway?: { id: string; skipCache?: boolean; cacheTtl?: number } },
  ): Promise<{ response?: unknown; result?: { response?: unknown }; usage?: { prompt_tokens?: number; completion_tokens?: number } }>
}
```

`createWorkerLlm.run` 末尾改为：
```ts
const raw = resp.response ?? resp.result?.response
const text = normalizeResponse(raw)
const usage = resp.usage
  ? { promptTokens: resp.usage.prompt_tokens, completionTokens: resp.usage.completion_tokens }
  : undefined
return { text, model: MODEL, usage }
```

recommend.ts 埋点 detail 里 `gateway: 'eatornot'` 改用 `gateway: GATEWAY_ID`（从 `./llm` import）。

- [ ] **Step 4: 改 recommend.ts（接 ctx + 埋点）**

签名加可选 `ctx?: TraceContext`：
```ts
import type { TraceContext } from '../observability/tracer'
export async function recommend(question, entries, enums, llm, ctx?: TraceContext): Promise<RecommendResponse> {
  const { candidates } = retrieve(question, entries, enums)
  ctx?.event({ type: 'ai_retrieve', route: 'recommend', ok: true, detail: { candidates: candidates.length, questionChars: question.length } })
  const { system, user } = buildRecommendPrompt(question, candidates)
  const t0 = Date.now()
  const { text, model, usage } = await llm.run({ system, user })
  ctx?.event({ type: 'ai_llm', route: 'recommend', ok: true, detail: { model, promptChars: system.length + user.length, gateway: 'eatornot', promptTokens: usage?.promptTokens } })
  let parsed: LlmRecommendResult
  try {
    parsed = parseJsonResponse(text) as LlmRecommendResult
    ctx?.event({ type: 'ai_parse', route: 'recommend', ok: true, detail: { rawChars: text.length } })
  } catch (e) {
    ctx?.event({ type: 'ai_parse', route: 'recommend', ok: false, detail: { rawChars: text.length, error: e instanceof Error ? e.message : 'parse fail' } })
    throw e
  }
  // ... 校验 picks（原逻辑）
  const dropped = (Array.isArray(parsed.picks) ? parsed.picks.length : 0) - picks.length
  ctx?.event({ type: 'ai_result', route: 'recommend', ok: true, detail: { picks: picks.length, dropped } })
  return { answer, picks, candidates_considered: candidates.length, model }
}
```

- [ ] **Step 5: 改 draft.ts（同结构，detail 用 warnings/fields）**

参照 recommend，`ai_result` detail = `{ warnings: result.warnings.length, fields: Object.keys(result.draft).length }`。

- [ ] **Step 6: 改 hono.ts（AI 路由开 ctx 透传）**

```ts
app.post('/api/ai/recommend', async (c) => {
  // ... 原校验 ...
  const ctx = tracer.begin('POST /api/ai/recommend', 'POST')
  try {
    const result = await recommend(question, all, enums, llm, ctx)
    return c.json(result)
  } catch (e) { /* 原逻辑 */ }
})
// draft 同理
```

- [ ] **Step 7: 跑全部测试通过**

Run: `cd tools && pnpm test 2>&1 | tail -10`
Expected: PASS（新增 AI trace 测试 + 全部回归）

- [ ] **Step 8: typecheck + validate**

Run: `cd tools && pnpm typecheck && pnpm validate 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 9: commit**

```bash
git add tools/src/server/ai/recommend.ts tools/src/server/ai/draft.ts tools/src/server/ai/llm.ts tools/src/server/hono.ts tools/tests/server/ai/llm.test.ts tools/tests/server/hono.test.ts
git commit -m "feat: AI 链路全埋点（retrieve/llm/parse/result），不记 prompt 全文"
```

---

## Task 4: worker.ts 注入双通道 Tracer + wrangler.jsonc 配 Analytics binding

**Files:**
- Modify: `tools/src/server/worker.ts`（构造 dual tracer：console + analytics，传给 createApp）
- Modify: `tools/wrangler.jsonc`（加 `analytics_engine_datasets`）
- Test: `tools/tests/server/worker.test.ts`（新增，验证 binding 存在时构造 dual tracer；缺失时降级 console）

**Interfaces:**
- Consumes: Task 1 全部 tracer 构造器
- Produces: `Env` 类型含 `ANALYTICS?: AnalyticsDataset`

- [ ] **Step 1: 写失败测试（worker 入口构造正确 tracer）**

把 tracer 构造逻辑抽成纯函数便于测试：
```ts
// worker.ts 内导出
export function buildTracer(env: { ANALYTICS?: AnalyticsDataset }): Tracer {
  if (env.ANALYTICS) return createDualTracer([createConsoleTracer(), createAnalyticsTracer(env.ANALYTICS, NOOP_TRACER)])
  return createConsoleTracer()
}
```

```ts
// tools/tests/server/worker.test.ts
import { describe, it, expect } from 'vitest'
import { buildTracer } from '../../src/server/worker'

describe('buildTracer', () => {
  it('无 ANALYTICS binding 时返回 console tracer（非 dual）', () => {
    const t = buildTracer({})
    expect(t).toBeDefined()
    // 调一次不抛即视为降级成功
    expect(() => t.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
  })
  it('有 ANALYTICSbinding 时返回 tracer 且 writeDataPoint 抛错也不影响', () => {
    const bad = { writeDataPoint() { throw new Error('x') } }
    const t = buildTracer({ ANALYTICS: bad })
    expect(() => t.begin('r').event({ type: 'http', route: 'r', ok: true })).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd tools && pnpm test -- worker.test 2>&1 | head`
Expected: FAIL（buildTracer 不存在）

- [ ] **Step 3: 改 worker.ts**

> **self-review 核实**：现有 `worker.ts` 用 `(env as unknown as { AI?: AiBinding }).AI` 访问 binding（`Env` 是 Workers 全局类型，非本地接口）。`ANALYTICS` 沿用同一 cast 模式，**不要**新建本地 `Env` 接口。把 `buildTracer` 定义在 worker.ts 内并导出（测试直接 import）。

```ts
import { createApp } from './hono'
import { createWorkerLoader } from './loader'
import { createWorkerLlm, type AiBinding } from './ai/llm'
import {
  createConsoleTracer, createAnalyticsTracer, createDualTracer, NOOP_TRACER,
  type Tracer, type AnalyticsDataset,
} from './observability/tracer'

// 由 env 构造 tracer：有 ANALYTICS binding 走双通道，否则降级 console（本地）。
export function buildTracer(env: { ANALYTICS?: AnalyticsDataset }): Tracer {
  if (env.ANALYTICS) {
    return createDualTracer([createConsoleTracer(), createAnalyticsTracer(env.ANALYTICS, NOOP_TRACER)])
  }
  return createConsoleTracer()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ai = (env as unknown as { AI?: AiBinding }).AI
    const analytics = (env as unknown as { ANALYTICS?: AnalyticsDataset }).ANALYTICS
    const llm = ai ? createWorkerLlm(ai) : undefined
    const tracer = buildTracer({ ANALYTICS: analytics })
    const app = createApp(createWorkerLoader(env.ASSETS), llm, tracer)
    return app.fetch(request)
  },
}
```

> worker.ts 用 tsconfig.worker.json（types:[]，禁用全局补全）。`Env` 仍为 Workers 全局类型，`ASSETS` 字段经全局 `Env` 可达，与现状一致。无需改 tsconfig.worker.json。

- [ ] **Step 4: 配 wrangler.jsonc**

```jsonc
{
  // ... 原有 ...
  "analytics_engine_datasets": [
    { "binding": "ANALYTICS", "dataset": "ai4food-trace" }
  ]
}
```

- [ ] **Step 5: 跑测试 + typecheck**

Run: `cd tools && pnpm test && pnpm typecheck 2>&1 | tail -10`
Expected: 全绿

- [ ] **Step 6: 本地 console 通道实测（手动）**

Run（手动）: `cd tools && pnpm run server`，另一终端 `curl http://localhost:8787/api/meta`，观察 server stdout 有 `{"traceId":...,"type":"http",...}` JSON 行。
Expected: 看到结构化日志（验证通道 A 端到端）。通道 B 需生产部署后 `wrangler tail` 验证（本地不可用）。

- [ ] **Step 7: commit + 标记 PR-A 完成**

```bash
git add tools/src/server/worker.ts tools/wrangler.jsonc tools/tests/server/worker.test.ts
git commit -m "feat: worker 注入双通道 Tracer，wrangler 配 Analytics Engine binding"
```

**→ 此时 P0（PR-A）完成，开 PR `feature/frontend-phase5` → main，待合并后再做 P1-P4。**

> 注：若希望 P0-P4 同分支一次性做完再合，可在 Task 4 后继续 Task 5-15 不开 PR，最后整体开一个 PR。计划默认 P0 单独 PR（spec 已确认）；执行时按用户最终偏好。

---

## Task 5: 后端抬高 MAX_LIMIT + 前端 api.ts 加列表/详情/meta 拉取

> 前端「全量拉取」（P1 数据源 API 化）需要后端允许一次性取回全部餐厅。当前 `hono.ts` 的 `MAX_LIMIT = 200`（见 self-review 核实），数据集超 200 家时会截断。本任务先把上限抬高（配置类前置，折叠进 P1），再写前端 api 客户端。

**Files:**
- Modify: `tools/src/server/hono.ts`（`MAX_LIMIT` 200 -> 5000；记一行注释说明为前端全量拉取）
- Test: `tools/tests/server/hono.test.ts`（新增用例：`limit=2000` 不被截断，返回全部）
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/tests/api.test.ts`
- Create: `frontend/src/types/api.ts`（放 `Meta` / `ListResponse` 类型）

**Interfaces:**
- Consumes: 已有 `API_BASE`, `ApiError`
- Produces:
  - `export interface ListResponse { data: RestaurantEntry[]; pagination: {...} }`
  - `export interface Meta { total: number; open: number; cities: string[]; cuisines: string[]; price_levels: number[] }`
  - `export async function fetchRestaurants(signal?: AbortSignal): Promise<RestaurantEntry[]>`
  - `export async function fetchRestaurantById(id: string, signal?: AbortSignal): Promise<RestaurantEntry | null>`
  - `export async function fetchMeta(signal?: AbortSignal): Promise<Meta>`

- [ ] **Step 1a: 写失败测试（后端 MAX_LIMIT 抬高后不截断）**

在 `hono.test.ts` 新增：
```ts
describe('MAX_LIMIT 抬高（前端全量拉取）', () => {
  it('limit=2000 时返回全部记录，不被截断', async () => {
    const big = Array.from({ length: 250 }, (_, i) => ({
      // 复用现有 entries[0] 形态，造 250 条不同 id 的记录
      ...entries[0], id: `cn-shanghai-n${i}`, name: `店${i}`, path: `p${i}`,
    }))
    const app = createApp(fakeLoader(big))
    const res = await app.request('/api/restaurants?limit=2000')
    const body = await jsonBody<{ data: unknown[]; pagination: { returned: number } }>(res)
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(250) // 250 < 5000，全量返回
  })
})
```

- [ ] **Step 2a: 跑测试确认失败**

Run: `cd tools && pnpm test -- hono.test 2>&1 | grep -E "截断|2000" | head`
Expected: FAIL（`MAX_LIMIT=200`，250 条被截断到 200）

- [ ] **Step 3a: 改 hono.ts**

```ts
// 前端列表页全量拉取（一次性取回，前端本地筛选）。抬高上限避免数据集增长后被截断。
const MAX_LIMIT = 5000
```

- [ ] **Step 4a: 跑测试确认通过**

Run: `cd tools && pnpm test -- hono.test 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5a: typecheck**

Run: `cd tools && pnpm typecheck 2>&1 | tail -3`
Expected: 无错误

- [ ] **Step 6a: commit（后端抬高上限，单独一个 commit）**

```bash
git add tools/src/server/hono.ts tools/tests/server/hono.test.ts
git commit -m "chore: 抬高列表 API MAX_LIMIT 到 5000，支持前端全量拉取"
```

- [ ] **Step 1b: 写失败测试（fetchRestaurants）**

```ts
// api.test.ts 追加
import { fetchRestaurants, fetchMeta, fetchRestaurantById } from '@/lib/api'

describe('fetchRestaurants', () => {
  it('成功返回 data 数组', async () => {
    mockFetch(jsonRes({ data: [{ id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜', price_level: 2, status: 'open', path: 'p' }], pagination: { total: 1, limit: 2000, offset: 0, returned: 1 } }))
    const r = await fetchRestaurants()
    expect(r).toHaveLength(1)
    expect(r[0]?.id).toBe('x')
    const url = String(vi.mocked(fetch).mock.calls[0]![0])
    expect(url).toMatch(/\/api\/restaurants/)
    const body = vi.mocked(fetch).mock.calls[0]![1] as RequestInit | undefined
    expect(body?.method ?? 'GET').toBe('GET')
  })
  it('500 抛 ApiError', async () => {
    mockFetch(jsonRes({ error: 'boom' }, 500))
    await expect(fetchRestaurants()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})
describe('fetchMeta', () => {
  it('返回 Meta', async () => {
    mockFetch(jsonRes({ total: 5, open: 4, cities: ['上海'], cuisines: ['本帮菜'], price_levels: [1, 2] }))
    const m = await fetchMeta()
    expect(m.total).toBe(5)
    expect(m.cuisines).toContain('本帮菜')
  })
})
describe('fetchRestaurantById', () => {
  it('200 返回 entry', async () => {
    mockFetch(jsonRes({ id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜', price_level: 2, status: 'open', path: 'p' }))
    const r = await fetchRestaurantById('x')
    expect(r?.id).toBe('x')
  })
  it('404 返回 null', async () => {
    mockFetch(jsonRes({ error: 'not found' }, 404))
    const r = await fetchRestaurantById('missing')
    expect(r).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- api.test 2>&1 | grep -E "FAIL|fetchRestaurants" | head`
Expected: FAIL

- [ ] **Step 3: 实现 api.ts 三个函数**

```ts
// types/api.ts
import type { RestaurantEntry } from './restaurant'
export interface Pagination { total: number; limit: number; offset: number; returned: number }
export interface ListResponse { data: RestaurantEntry[]; pagination: Pagination }
export interface Meta { total: number; open: number; cities: string[]; cuisines: string[]; price_levels: number[] }

// lib/api.ts 追加
import type { ListResponse, Meta } from '@/types/api'

export async function fetchRestaurants(signal?: AbortSignal): Promise<RestaurantEntry[]> {
  const url = `${API_BASE}/api/restaurants?limit=2000`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const body = (await res.json()) as ListResponse
  return body.data
}

export async function fetchRestaurantById(id: string, signal?: AbortSignal): Promise<RestaurantEntry | null> {
  const res = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(id)}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as RestaurantEntry
}

export async function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta`, { signal })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as Meta
}
```

- [ ] **Step 4: 跑测试通过**

Run: `cd frontend && pnpm test -- api.test 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add frontend/src/lib/api.ts frontend/src/types/api.ts frontend/src/tests/api.test.ts
git commit -m "feat: 前端 api 客户端加列表/详情/meta 拉取"
```

---

## Task 6: store 数据源切换到 API

**Files:**
- Modify: `frontend/src/stores/restaurants.ts`（`load()` 改调 `fetchRestaurants()`）

- [ ] **Step 1: 改 load() + 新增 retry()**

> **self-review 核实**：现有 store（`frontend/src/stores/restaurants.ts`）状态为 `all/loaded/error`，`load()` 第 44-55 行直接 `fetch(${BASE_URL}dist/index.json)`，无 loaded 守卫。本步改 fetch 目标为 API，并新增 `retry()` 供错误边界调用，保留原有「失败也置 loaded=true」语义。

```ts
import { fetchRestaurants } from '@/lib/api'
// ...
async function load(): Promise<void> {
  try {
    const data = await fetchRestaurants()
    all.value = Array.isArray(data) ? data : []
    error.value = null
    loaded.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    loaded.value = true // 标记已尝试，触发错误边界
  }
}
async function retry(): Promise<void> {
  error.value = null
  loaded.value = false
  await load()
}
// return 增加 retry
return { all, loaded, error, query, cuisine, price, onlyOpen, mergeChains, load, retry, filtered, visible, stats, cuisineOptions }
```

- [ ] **Step 2: 验证列表页仍正常（typecheck + build）**

Run: `cd frontend && pnpm typecheck && pnpm build 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 3: 手动联调（手动）**

`cd frontend && VITE_API_BASE=http://localhost:8787 pnpm dev`（后端另开 `cd tools && pnpm run server`），访问首页确认 73 家加载。
Expected: 列表正常显示。

- [ ] **Step 4: commit**

```bash
git add frontend/src/stores/restaurants.ts
git commit -m "feat: store 数据源从打包 index.json 切换到后端 API"
```

---

## Task 7: 前端不再打包 dist/index.json

**Files:**
- Modify: `frontend/vite.config.ts`（确认 public 不再拷贝 index.json）/ CI 工作流（去掉前端构建依赖 index.json 拷贝步骤）
- Read: `.github/workflows/*.yml`

- [ ] **Step 1: 查前端如何引用 index.json**

Run: `cd frontend && grep -rn "index.json\|dist/index" src vite.config.* ../.github/workflows 2>&1 | head`
Expected: 找到引用点（store.load 原始 fetch `${BASE_URL}dist/index.json`、vite public 拷贝、CI 拷贝步骤）

- [ ] **Step 2: 移除打包依赖**

- store 已在 Task 6 改为 API。
- 若 `frontend/public/` 有 index.json 软链/拷贝或 vite 配置 copy，移除。
- CI workflow 中「拷贝 dist/index.json 到 frontend/dist」步骤删除（保留前端 build + deploy）。

- [ ] **Step 3: 构建确认无 index.json 残留**

Run: `cd frontend && pnpm build && ls dist 2>&1`
Expected: dist 下无 index.json（或仅前端自身产物）

- [ ] **Step 4: commit**

```bash
git add frontend/vite.config.ts .github/workflows/*.yml
git commit -m "chore: 前端不再打包 index.json，数据运行时走 API"
```

**→ P1（PR-B）完成。**

---

## Task 8: useUrlSync 纯函数（筛选 ↔ URL）

**Files:**
- Create: `frontend/src/composables/useUrlSync.ts`
- Test: `frontend/src/tests/useUrlSync.test.ts`

**Interfaces:**
- Produces:
  - `export interface UrlFilters { q: string; cuisine: string; price: number; open: boolean; merge: boolean }`
  - `export function encodeFilters(f: UrlFilters): URLSearchParams`
  - `export function decodeFilters(p: URLSearchParams): Partial<UrlFilters>`

**约定**：`open` 默认 true，URL 省略视为 true，`open=0` 才 false；`merge` 默认 true 同理；`price=0` 表示不限。

- [ ] **Step 1: 写失败测试（覆盖边界）**

```ts
import { describe, it, expect } from 'vitest'
import { encodeFilters, decodeFilters } from '@/composables/useUrlSync'

describe('encode/decode 往返', () => {
  it('全字段往返一致', () => {
    const f = { q: '火锅', cuisine: '川菜', price: 2, open: false, merge: true }
    expect(decodeFilters(encodeFilters(f))).toEqual(f)
  })
  it('open/merge 为默认 true 时不写进 URL', () => {
    const s = encodeFilters({ q: '', cuisine: '', price: 0, open: true, merge: true })
    expect(s.toString()).toBe('')
  })
  it('空 URL 解码出空（无字段）', () => {
    expect(decodeFilters(new URLSearchParams())).toEqual({})
  })
  it('open=0 解码为 false', () => {
    expect(decodeFilters(new URLSearchParams('open=0')).open).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- useUrlSync 2>&1 | head`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
export interface UrlFilters { q: string; cuisine: string; price: number; open: boolean; merge: boolean }
export function encodeFilters(f: UrlFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.cuisine) p.set('cuisine', f.cuisine)
  if (f.price) p.set('price', String(f.price))
  if (!f.open) p.set('open', '0')        // 默认 true，只记 false
  if (!f.merge) p.set('merge', '0')      // 默认 true，只记 false
  return p
}
export function decodeFilters(p: URLSearchParams): Partial<UrlFilters> {
  const out: Partial<UrlFilters> = {}
  if (p.has('q')) out.q = p.get('q') ?? ''
  if (p.has('cuisine')) out.cuisine = p.get('cuisine') ?? ''
  if (p.has('price')) out.price = Number(p.get('price')) || 0
  if (p.has('open')) out.open = p.get('open') !== '0'  // 有值且非0才... 实际 open=0→false，其他→true
  if (p.has('merge')) out.merge = p.get('merge') !== '0'
  return out
}
```

- [ ] **Step 4: 跑测试通过**

Run: `cd frontend && pnpm test -- useUrlSync 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add frontend/src/composables/useUrlSync.ts frontend/src/tests/useUrlSync.test.ts
git commit -m "feat: 筛选条件 URL 编解码纯函数"
```

---

## Task 9: RestaurantList 接入 URL 双向同步

**Files:**
- Modify: `frontend/src/views/RestaurantList.vue`（onMounted 读 URL 回填；watch store 筛选 → router.replace）
- Modify: `frontend/src/stores/restaurants.ts`（暴露 setFilters 便于批量回填）

- [ ] **Step 1: 改 RestaurantList.vue script**

```ts
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { encodeFilters, decodeFilters } from '@/composables/useUrlSync'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const fromUrl = decodeFilters(new URLSearchParams(route.query as Record<string, string>))
  if (Object.keys(fromUrl).length) {
    if (fromUrl.q !== undefined) store.query = fromUrl.q
    if (fromUrl.cuisine !== undefined) store.cuisine = fromUrl.cuisine
    if (fromUrl.price !== undefined) store.price = fromUrl.price
    if (fromUrl.open !== undefined) store.onlyOpen = fromUrl.open
    if (fromUrl.merge !== undefined) store.mergeChains = fromUrl.merge
  }
  if (!store.loaded) store.load()
})

watch(
  () => [store.query, store.cuisine, store.price, store.onlyOpen, store.mergeChains],
  () => {
    router.replace({ query: encodeFilters({ q: store.query, cuisine: store.cuisine, price: store.price, open: store.onlyOpen, merge: store.mergeChains }) })
  },
)
```

- [ ] **Step 2: typecheck + build**

Run: `cd frontend && pnpm typecheck && pnpm build 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 3: 手动验证（手动）**

改筛选后看地址栏 query 变化；前进后退筛选回填；复制带 query 的 URL 新开页筛选一致。
Expected: URL 同步生效。

- [ ] **Step 4: commit**

```bash
git add frontend/src/views/RestaurantList.vue
git commit -m "feat: 列表筛选条件与 URL 双向同步"
```

---

## Task 10: 骨架屏 + 错误边界 + 空态组件

**Files:**
- Create: `frontend/src/components/SkeletonCard.vue`
- Create: `frontend/src/components/ErrorBoundary.vue`
- Create: `frontend/src/components/EmptyState.vue`
- Test: `frontend/src/tests/components.test.ts`（@vue/test-utils 挂载）

- [ ] **Step 1: 写组件测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonCard from '@/components/SkeletonCard.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import EmptyState from '@/components/EmptyState.vue'

describe('SkeletonCard', () => {
  it('渲染占位结构', () => {
    const w = mount(SkeletonCard)
    expect(w.classes()).toContain('skeleton-card')
  })
})
describe('ErrorBoundary', () => {
  it('显示错误消息与重试按钮', async () => {
    const w = mount(ErrorBoundary, { props: { message: '加载失败' } })
    expect(w.text()).toContain('加载失败')
    expect(w.find('button').exists()).toBe(true)
    await w.find('button').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })
})
describe('EmptyState', () => {
  it('点击重置触发 reset 事件', async () => {
    const w = mount(EmptyState)
    await w.find('button').trigger('click')
    expect(w.emitted('reset')).toBeTruthy()
  })
})
```

> 需确认 `@vue/test-utils` 已装（package.json）。若未装，先 `pnpm add -D @vue/test-utils`（chore commit）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- components.test 2>&1 | head`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 实现三组件**

SkeletonCard.vue：脉冲占位卡片（无 props，纯样式）。
ErrorBoundary.vue：`props: { message: string }`；模板显示 ⚠️ + message + 「重试」按钮 `@click="$emit('retry')"`。
EmptyState.vue：「没有匹配的餐厅」+「重置筛选」按钮 `@click="$emit('reset')"`。

（具体模板与样式见 spec 详细设计第 3 节，组件小，此处略具体 CSS，实现时匹配 RestaurantCard 视觉风格。）

- [ ] **Step 4: 跑测试通过**

Run: `cd frontend && pnpm test -- components.test 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add frontend/src/components/SkeletonCard.vue frontend/src/components/ErrorBoundary.vue frontend/src/components/EmptyState.vue frontend/src/tests/components.test.ts
git commit -m "feat: 骨架屏/错误边界/空态组件"
```

---

## Task 11: RestaurantList 接入骨架/错误/空态

**Files:**
- Modify: `frontend/src/views/RestaurantList.vue`

- [ ] **Step 1: 改模板**

```vue
<main class="wrap">
  <ErrorBoundary v-if="store.error" :message="`数据加载失败：${store.error}`" @retry="store.retry" />
  <div v-else-if="!store.loaded" class="grid">
    <SkeletonCard v-for="n in 8" :key="n" />
  </div>
  <EmptyState v-else-if="!store.visible.length" @reset="resetFilters" />
  <div v-else class="grid">
    <!-- 原 v-for -->
  </div>
</main>
```

```ts
function resetFilters() {
  store.query = ''
  store.cuisine = ''
  store.price = 0
}
```

- [ ] **Step 2: typecheck + build**

Run: `cd frontend && pnpm typecheck && pnpm build 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 3: 手动验证（手动）**

- 关后端 → 错误边界 + 重试。
- 正常 → 短暂骨架 → 列表。
- 筛选无果 → 空态 + 重置。
Expected: 三态均正确。

- [ ] **Step 4: commit**

```bash
git add frontend/src/views/RestaurantList.vue
git commit -m "feat: 列表页接入骨架屏/错误边界/空态"
```

**→ P2（PR-C）完成。**

---

## Task 12: recommend.ts 连锁去重纯函数

**Files:**
- Create: `frontend/src/lib/recommend.ts`
- Test: `frontend/src/tests/recommend.test.ts`

**Interfaces:**
- Consumes: `RecommendPick`（`@/types/ai`）、`brandKey`（`@/composables/useChains`）
- Produces: `export function dedupeChainPicks(picks: RecommendPick[]): RecommendPick[]`

**逻辑**：按品牌键分组，每组留 score 最高；无 id 的 pick 视为单店保留。注意 picks 可能无 name，需用 id 反查——但 picks 来自后端不含 brandKey 所需字段。**修正**：去重依赖 id，brandKey 需 entry。picks 只有 id/name/reason/score。故去重按 **name**（同品牌名）分组即可；同 name 取 score 最高。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { dedupeChainPicks } from '@/lib/recommend'
import type { RecommendPick } from '@/types/ai'

const mk = (over: Partial<RecommendPick>): RecommendPick => ({ id: 'x', reason: 'r', score: 0.5, ...over })

describe('dedupeChainPicks', () => {
  it('同名（连锁）只留 score 最高', () => {
    const r = dedupeChainPicks([
      mk({ id: 'a', name: '海底捞', score: 0.7 }),
      mk({ id: 'b', name: '海底捞', score: 0.9 }),
      mk({ id: 'c', name: '西贝', score: 0.8 }),
    ])
    expect(r.map((p) => p.id)).toEqual(['b', 'c'])
  })
  it('无 name 的 pick 各自保留', () => {
    const r = dedupeChainPicks([mk({ id: 'a', name: undefined, score: 0.1 }), mk({ id: 'b', name: undefined, score: 0.9 })])
    expect(r).toHaveLength(2)
  })
  it('保持原顺序（首现优先，分数相同时）', () => {
    const r = dedupeChainPicks([mk({ id: 'a', name: 'X', score: 0.5 }), mk({ id: 'b', name: 'X', score: 0.5 })])
    expect(r.map((p) => p.id)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- recommend.test 2>&1 | head`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import type { RecommendPick } from '@/types/ai'

export function dedupeChainPicks(picks: RecommendPick[]): RecommendPick[] {
  const seen = new Map<string, RecommendPick>()
  const result: RecommendPick[] = []
  for (const p of picks) {
    const key = p.name?.trim()
    if (!key) { result.push(p); continue } // 无名视为独立
    const prev = seen.get(key)
    if (!prev) {
      seen.set(key, p)
      result.push(p)
    } else if ((p.score ?? 0) > (prev.score ?? 0)) {
      // 替换：找到 result 中的 prev 位置替换
      const idx = result.indexOf(prev)
      result[idx] = p
      seen.set(key, p)
    }
  }
  return result
}
```

- [ ] **Step 4: 跑测试通过**

Run: `cd frontend && pnpm test -- recommend.test 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add frontend/src/lib/recommend.ts frontend/src/tests/recommend.test.ts
git commit -m "feat: 推荐结果连锁去重纯函数"
```

---

## Task 13: AskAi 接入去重

**Files:**
- Modify: `frontend/src/views/AskAi.vue`

- [ ] **Step 1: 改 script**

```ts
import { computed } from 'vue'
import { dedupeChainPicks } from '@/lib/recommend'
// ...
const dedupedPicks = computed(() => recommendResult.value ? dedupeChainPicks(recommendResult.value.picks) : [])
```

模板 `v-for="pick in recommendResult.picks"` 改 `v-for="pick in dedupedPicks"`，空判断 `recommendResult.picks.length` 改 `dedupedPicks.value.length`。

- [ ] **Step 2: typecheck + build**

Run: `cd frontend && pnpm typecheck && pnpm build 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 3: commit**

```bash
git add frontend/src/views/AskAi.vue
git commit -m "feat: 推荐展示前连锁去重"
```

**→ P3（PR-D）完成。**

---

## Task 14: closeDraft.ts 关闭草稿 + GitHub URL

**Files:**
- Create: `frontend/src/lib/closeDraft.ts`
- Test: `frontend/src/tests/closeDraft.test.ts`

**Interfaces:**
- Consumes: `RestaurantEntry`、`lib/draft.ts` 的 escapeYaml（需 export 或复用）
- Produces:
  - `export function buildClosedMarkdown(entry: RestaurantEntry, reason?: string): string`
  - `export function buildGithubEditUrl(entry: RestaurantEntry, newContent: string): string`

**行为**：
- `buildClosedMarkdown`：保留原 frontmatter 全字段，改 `status: closed`、`tags` 末尾追加「已关店」（去重）、`notes` 末尾追加关闭说明、正文标题加「（已关闭）」。
- `buildGithubEditUrl`：`https://github.com/fgh23333/AI4Food/edit/main/${entry.path}?value=${encodeURIComponent(newContent)}`；path 缺失时抛错或返回 new-file URL（测试固定形态）。

> **依赖前置（self-review 核实）**：`lib/draft.ts` 现有的 `escapeYaml` 是**私有函数（未 export，第 69 行）**。本任务需先把 `escapeYaml` 改为 `export`（同一 commit，属本任务范围），`closeDraft.ts` 才能复用。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { buildClosedMarkdown, buildGithubEditUrl } from '@/lib/closeDraft'
import type { RestaurantEntry } from '@/types/restaurant'

const entry = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试店', city: '上海', country: 'cn', cuisine: '本帮菜',
  price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md', ...over,
})

describe('buildClosedMarkdown', () => {
  it('status 改 closed，tags 追加已关店，标题加（已关闭）', () => {
    const md = buildClosedMarkdown(entry({ tags: ['本帮'] }), '搬迁')
    expect(md).toContain('status: closed')
    expect(md).toContain('已关店')
    expect(md).toContain('# 测试店（已关闭）')
  })
  it('原 tags 已含已关店时不重复追加', () => {
    const md = buildClosedMarkdown(entry({ tags: ['本帮', '已关店'] }))
    expect(md.match(/已关店/g)?.length).toBe(1)
  })
  it('reason 写入 notes', () => {
    const md = buildClosedMarkdown(entry(), '用户反馈已关')
    expect(md).toContain('用户反馈已关')
  })
})

describe('buildGithubEditUrl', () => {
  it('拼出 edit 端点并编码 value', () => {
    const url = buildGithubEditUrl(entry(), '# 测试\n')
    expect(url.startsWith('https://github.com/fgh23333/AI4Food/edit/main/data/restaurants/cn/shanghai/x.md?value=')).toBe(true)
    expect(url).toContain(encodeURIComponent('# 测试\n'))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- closeDraft.test 2>&1 | head`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import type { RestaurantEntry } from '@/types/restaurant'
import { draftToMarkdown } from './draft' // 复用转义逻辑；若 draftToMarkdown 签名不匹配则提取 escapeYaml 复用

export function buildClosedMarkdown(entry: RestaurantEntry, reason?: string): string {
  // 基于 entry 重建 frontmatter，status/tags/notes/title 按关闭语义改写
  // （具体实现：手写 frontmatter 行，复用 escapeYaml；保留 entry 所有字段）
  // ... 见 draft.ts 的写法
}

export function buildGithubEditUrl(entry: RestaurantEntry, newContent: string): string {
  return `https://github.com/fgh23333/AI4Food/edit/main/${entry.path}?value=${encodeURIComponent(newContent)}`
}
```

> 实现细节：若 `lib/draft.ts` 未 export escapeYaml，先在 Task 14 内补充 export（小改动），或复制等价逻辑。保持 DRY。

- [ ] **Step 4: 跑测试通过**

Run: `cd frontend && pnpm test -- closeDraft.test 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add frontend/src/lib/closeDraft.ts frontend/src/lib/draft.ts frontend/src/tests/closeDraft.test.ts
git commit -m "feat: 生成「标记关闭」变更草稿与 GitHub 编辑 URL"
```

---

## Task 15: MarkClosedButton 组件 + 详情页接入

**Files:**
- Create: `frontend/src/components/MarkClosedButton.vue`
- Modify: `frontend/src/views/RestaurantDetail.vue`
- Test: `frontend/src/tests/components.test.ts`（追加）

- [ ] **Step 1: 写组件测试**

```ts
describe('MarkClosedButton', () => {
  it('点击跳转 window.open 到 GitHub edit URL', async () => {
    const openSpy = vi.stubGlobal('open', vi.fn())
    const w = mount(MarkClosedButton, { props: { entry: { id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜', price_level: 2, status: 'open', path: 'data/x.md' } } })
    await w.find('button').trigger('click')
    const calledUrl = (openSpy as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]
    expect(calledUrl.startsWith('https://github.com/fgh23333/AI4Food/edit/main/data/x.md')).toBe(true)
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm test -- components.test 2>&1 | grep MarkClosedButton | head`
Expected: FAIL

- [ ] **Step 3: 实现组件**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'
import { buildClosedMarkdown, buildGithubEditUrl } from '@/lib/closeDraft'

const props = defineProps<{ entry: RestaurantEntry }>()
const reason = ref('')
const open = () => {
  const md = buildClosedMarkdown(props.entry, reason.value.trim() || undefined)
  window.open(buildGithubEditUrl(props.entry, md), '_blank')
}
</script>
<template>
  <div class="mark-closed">
    <input v-model="reason" placeholder="关闭原因（可选）" />
    <button @click="open">这家店已关闭？提交关闭草稿</button>
  </div>
</template>
```

- [ ] **Step 4: 接入 RestaurantDetail.vue**

详情页底部加 `<MarkClosedButton :entry="entry" />`（确认 entry 可用；RestaurantDetail 取数方式见现有实现）。

- [ ] **Step 5: typecheck + build**

Run: `cd frontend && pnpm typecheck && pnpm build 2>&1 | tail -5`
Expected: 无错误

- [ ] **Step 6: 手动验证（手动）**

详情页点按钮 → 新标签打开 GitHub edit 页，内容预填 status closed + 已关店 tag。
Expected: 预填正确。

- [ ] **Step 7: commit**

```bash
git add frontend/src/components/MarkClosedButton.vue frontend/src/views/RestaurantDetail.vue frontend/src/tests/components.test.ts
git commit -m "feat: 详情页「标记已关闭」按钮，生成草稿跳转 GitHub 预填"
```

**→ P4（PR-E）完成。**

---

## 完成后（最终全量验证）

- [ ] **后端全绿**: `cd tools && pnpm typecheck && pnpm test && pnpm validate`
- [ ] **前端全绿**: `cd frontend && pnpm typecheck && pnpm test && pnpm build`
- [ ] **生产 trace 验证（部署后）**: `wrangler tail` 观察生产请求的 `http`/`ai_*` 事件；dashboard Analytics Engine 查 `ai4food-trace` dataset 有数据点。
- [ ] **更新文档**: `docs/ROADMAP.md` 加五期已实现条目；`README.md` 视需要补可观测性说明。

## Self-Review 备注

本计划已逐条对照实际源码核实，修正点记录如下（执行者可据此信任代码片段的准确性）：

- **trace 不记全文**：约束落实在 detail 约定 + truncate（TextEncoder/TextDecoder 两端兼容，不用 Buffer——Worker 运行时无 Buffer）。
- **Analytics binding 本地不可用**：Task 1/4 用 mock 测，Task 4 Step 6 手动验 console 通道；B 通道靠生产 wrangler tail 验证（spec 风险表已列）。
- **前后端类型已对齐**：核实过 IndexEntry（tools/src/types.ts）含 address/latitude/longitude/phone/notes/description，与前端 RestaurantEntry 字段一致，Task 5/6 无字段缺失。
- **hono.ts MAX_LIMIT = 200（第 11 行）**：会截断前端 limit=2000 全量拉取。已在 Task 5 前置抬高到 5000（配回归测试），属 P1 必要前置，折叠进 Task 5 同一 PR。
- **createApp(loader, llm?: LlmClient)（第 77 行）**：第三参数 tracer 为可选新增，默认 NOOP_TRACER，不破坏现有测试（Task 2「不传 tracer」用例验证）。
- **llm.ts 现状核实**：LlmOutput = { text, model }（第 14-17 行），AiBinding.run 返回 { response?, result? }（第 27-33 行），GATEWAY_ID = eatornot 已 export（第 7 行）。Task 3 增量加 usage，recommend 埋点用 GATEWAY_ID 而非硬编码。
- **worker.ts 用 (env as unknown as { AI?: AiBinding }).AI cast 访问 binding**（Env 是 Workers 全局类型，非本地接口）。Task 4 的 ANALYTICS 沿用同一 cast 模式，不新建本地 Env 接口，buildTracer 定义在 worker.ts 内导出供测试 import。
- **lib/draft.ts 的 escapeYaml 是私有函数（第 69 行，未 export）**：Task 14 需先改为 export（同 commit），closeDraft.ts 才能复用。
- **store 现状**：load() 第 44-55 行无 loaded 守卫、失败也置 loaded=true。Task 6 保留此语义，新增 retry()，状态变量名 all/loaded/error 与现有一致。
- **推荐去重按 name 分组**：picks 只含 id/name/reason/score，无 brandKey 所需 entry 字段，故按 name（同品牌名）去重，同 name 取 score 最高（Task 12 已说明）。
- **hono trace 中间件不用 c.set**：Hono c.set 需泛型类型声明，徒增 strict 抖动；改用闭包变量 ctx 携带。http ctx 与 AI 路由 ctx 独立 traceId（便于 Analytics 按事件类型过滤）。
- **truncate 截断 15KB**：detail JSON 超 15KB 按字节截断，留余量给 route/method blob，确保不触 16KB 总量上限。
