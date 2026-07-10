# 五期：可观测性 + 体验增强 + API 化 + 智能推荐优化 + 贡献辅助 设计文档

> 日期：2026-07-10　｜　状态：待评审　｜　依据：`docs/ROADMAP.md`「何时启动下一期」

## 背景与动机

一期至四期已全部落地（数据仓库 / 后端只读 API / Vue SPA / AI 能力）。PR #8（AI 草稿可编辑表单）已合并，主线无遗留债务。

用户提出五类诉求，构成本期（按优先级排序）：

0. **可观测性优先**——所有 AI 行为（检索候选数、LLM 调用、token、解析成败、反幻觉丢弃数）和后端接口（路由、耗时、状态码）都要可 trace。痛点：四期生产 500 排查时只能靠 AI Gateway 日志反推，后端全程无日志。
1. **数据更新不重新打包前端**——目前 SPA 静态打包 `dist/index.json`，每改一条数据都要 CI 重建前端。希望数据与前端解耦。
2. **推荐质量优化**——连锁品牌会推多家重复。（定位推最近 / 地图视图**已确认延后到后续期**。）
3. **前端能标记店铺关闭**——降低贡献门槛，但须遵守「`data/` 只放人类手写数据」铁律。
4. **体验细节**——筛选状态无法分享/前进后退；加载/错误/空态偏简陋。

## 目标

- **可观测性（最高优先级）**：后端 5 个路由 + AI 全链路埋点，双通道输出——`console.log`（Workers Observability 自动采集，`wrangler tail` 实时看）+ Analytics Engine（长期留存、SQL 查询）。
- 餐厅数据运行时从后端 API 拉取，数据更新不再触发前端重打包。
- 列表筛选条件（搜索词、菜系、价位、仅营业、合并连锁）与 URL query 双向同步。
- 加载态用骨架屏，加载失败给重试按钮，无结果给空态引导。
- 智能推荐：同一连锁品牌只保留一家分店（**定位推最近延后**，本期用 score 最高兜底）。
- 详情页提供「标记已关闭」入口：生成 `status: closed` 变更草稿，跳转 GitHub 在线编辑页预填内容，由人确认提交 PR（不直接写 `data/`）。

## 非目标（YAGNI）

- ❌ 不做地图视图（三期已 descoped）。
- ❌ 不做定位推荐（4b 就近选择）——延后到后续期。
- ❌ 不做用户登录、收藏夹、对比页（本期外）。
- ❌ 不做 AI 推荐流式 SSE（独立大改，留待后续）。
- ❌ 前端不直接写 `data/`，标记关闭仍走人工 PR。
- ❌ 本期不建 Analytics 查询面板/dashboard（数据写进去即可，查询用 SQL API 手动跑；面板是后续）。

## 实施优先级（trace 先行）

1. **P0 可观测性**——先埋点，让后续所有改动可被观察。
2. **P1 数据源改走 API**——地基，影响骨架屏/错误边界设计。
3. **P2 体验**（URL 同步 + 骨架屏 + 错误边界 + 空态）。
4. **P3 推荐连锁去重**。
5. **P4 标记关闭草稿**。

---

## 全局约束

- **数据铁律**：`data/` 只放人类手写数据；前端、AI 均不写 `data/`。「标记关闭」只生成草稿文本 + 跳转 GitHub，落地仍需人提交。
- **数据源**：运行时统一走二期后端 API `https://ai4food.635262140.xyz`（可被 `VITE_API_BASE` 覆盖，本地联调用 `http://localhost:8787`）。前端包不再含 `dist/index.json`。
- **类型一致性**：前端 `RestaurantEntry`（`frontend/src/types/restaurant.ts`）与后端 `IndexEntry`（`tools/src/types.ts`）字段已对齐，本期维持。
- **分支与提交**：本期为工具/前端类改动，用 `feature/frontend-phase5` 分支；commit 用 `feat:`/`fix:`/`chore:`/`docs:`。不推 `main`，开 PR，一条 PR 一件事。
- **TDD**：纯逻辑（URL 编解码、连锁去重、关闭草稿生成、tracer 映射）先写 Vitest 测试。
- **TypeScript strict + noUncheckedIndexedAccess**：禁用 `any`。
- **CORS**：后端已白名单 `fgh23333.github.io` + localhost，前端跨域调 API 已具备条件。
- **可降级**：API 不可达时，错误边界提示重试，不让整个站点白屏。

---

## 架构

### 数据流变化

```
[三期现状]  GitHub Pages SPA ──读──> 打包进 dist 的 index.json（数据更新需重打包）
                          │
[五期目标]  GitHub Pages SPA ──fetch──> 二期后端 API (Cloudflare Workers)
                                          └──读──> dist/index.json（静态资产绑定）
                          数据更新只触发「重建索引 + Worker 部署」，前端零打包
```

前端 `stores/restaurants.ts` 的 `load()` 从 `fetch(BASE_URL/dist/index.json)` 改为 `fetch(API_BASE/api/restaurants?city=上海&limit=...)`，结果取 `data` 字段。

### 模块划分（按职责，单一职责）

**后端（tools/）——可观测性优先：**

| 文件 | 职责 | 新增/修改 |
|------|------|----------|
| `tools/src/server/observability/tracer.ts` | Tracer 抽象（Console/Analytics/双通道）、TraceRecord schema | 新增 |
| `tools/src/server/hono.ts` | 路由埋点（http 事件中间件 + 注入 tracer） | 修改 |
| `tools/src/server/ai/recommend.ts` | AI 链路埋点（retrieve/llm/parse/result） | 修改 |
| `tools/src/server/ai/draft.ts` | AI 链路埋点 | 修改 |
| `tools/src/server/ai/llm.ts` | LLM 调用埋点（model/promptChars/usage） | 修改 |
| `tools/src/server/worker.ts` | env.ANALYTICS 注入、构造双通道 Tracer | 修改 |
| `tools/wrangler.jsonc` | 加 `analytics_engine_datasets` binding | 修改 |
| `tools/tests/server/observability/tracer.test.ts` | Tracer 单测 | 新增 |
| `tools/tests/server/hono.test.ts` | 注入 mock tracer 验证埋点 | 修改 |

**前端（frontend/）：**

| 文件 | 职责 | 新增/修改 |
|------|------|----------|
| `frontend/src/lib/api.ts` | API 客户端（已有 recommend/draft；新增列表/详情/meta 拉取） | 修改 |
| `frontend/src/stores/restaurants.ts` | 数据源切换到 API；筛选状态 | 修改 |
| `frontend/src/composables/useUrlSync.ts` | 筛选条件 ↔ URL query 双向同步 | 新增 |
| `frontend/src/lib/recommend.ts` | 推荐结果连锁去重（纯函数） | 新增 |
| `frontend/src/lib/closeDraft.ts` | 生成「标记关闭」变更草稿 + GitHub 预填 URL | 新增 |
| `frontend/src/components/SkeletonCard.vue` | 卡片骨架屏 | 新增 |
| `frontend/src/components/ErrorBoundary.vue` | 加载失败 + 重试 | 新增 |
| `frontend/src/components/EmptyState.vue` | 无结果引导 | 新增 |
| `frontend/src/components/MarkClosedButton.vue` | 详情页「标记已关闭」按钮 | 新增 |
| `frontend/src/views/RestaurantList.vue` | 接入骨架屏/错误/空态/URL 同步 | 修改 |
| `frontend/src/views/RestaurantDetail.vue` | 接入「标记已关闭」按钮 | 修改 |
| `frontend/src/views/AskAi.vue` | 推荐结果连锁去重展示 | 修改 |

---

## 详细设计

### 0. 可观测性：trace 双通道（P0，先做）

**双通道架构**：每个埋点事件同时发往两条通道，由公共 `Tracer` 抽象统一封装，业务代码只调 `tracer.event(...)`。

```
业务路由 ──> tracer.event({type, ...fields})
                ├── console.log(JSON.stringify(record))   # 通道 A：Workers Observability 自动采集
                └── env.ANALYTICS.writeDataPoint({...})   # 通道 B：Analytics Engine（仅生产）
```

**通道 A（console.log）**：零配置。Workers Observability 自动采集 stdout，`wrangler tail` 实时流、dashboard 可查。本地联调（Node server）也走这条。**保留期有限（约 3-7 天），偏实时排查**。

**通道 B（Analytics Engine）**：长期留存（数月）、SQL API 查询。需在 wrangler.jsonc 配 binding。**binding 不能本地使用**——故本地仅 A 通道，生产 A+B 双发。trace schema 字段规范化，两通道结构一致，A 的 JSON 即 B 写入字段的原型。

**Trace schema**（统一 record 结构）：

| 字段 | 类型 | 通道映射 | 说明 |
|------|------|---------|------|
| `ts` | number | doubles[0] | 事件时间戳（ms，epoch） |
| `traceId` | string | indexes[0] | 每请求生成（crypto.randomUUID 前 8 位），串联同请求所有事件 |
| `type` | string | indexes[1] | 事件类型：`http` / `ai_retrieve` / `ai_llm` / `ai_parse` / `ai_result` |
| `route` | string | blobs[0] | 路由，如 `POST /api/ai/recommend` |
| `method` | string | blobs[1] | HTTP 方法 |
| `status` | number | doubles[1] | HTTP 状态码 |
| `durationMs` | number | doubles[2] | 耗时 |
| `ok` | number | doubles[3] | 1 成功 / 0 失败 |
| `detail` | string | blobs[2] | 结构化 JSON 字符串，按事件类型装额外字段（见下），总量 <16KB |

**AI 事件 `detail` 内容**（这正是「所有 AI 行为可 trace」的核心）：
- `ai_retrieve`：`{ candidates, question }`（规则检索候选数 + 原始问题）
- `ai_llm`：`{ model, promptChars, gateway, cached }`（LLM 调用：模型/提示词长度/网关/是否命中缓存）
- `ai_parse`：`{ rawChars, ok, error }`（JSON 解析：原始响应长度/成功否/失败原因）
- `ai_result`：`{ picks, dropped }`（推荐：最终选出几家/反幻觉丢弃几家）+ `draft`：`{ warnings, fields }`

**埋点位置**：
- `hono.ts` 每个路由：入口记 `traceId` + `ts`，出口记 `status` + `durationMs`（用中间件统一记 `http` 事件）。
- `recommend.ts`/`draft.ts`：在 retrieve、llm.run、parseJson、校验四处各埋一个事件。
- `llm.ts` 的 `createWorkerLlm.run`：记 `ai_llm`（含 token——若 `ai.run` 返回 usage 字段则记录，否则只记 promptChars）。

**公共 Tracer 模块**（新增 `tools/src/server/observability/tracer.ts`）：

```ts
export interface TraceRecord {
  type: string
  route: string
  method?: string
  status?: number
  durationMs?: number
  ok: boolean
  detail?: Record<string, unknown>
}
export interface AnalyticsDataset {
  writeDataPoint(p: { indexes: string[]; blobs: string[]; doubles: number[] }): void
}
// ConsoleTracer（本地/通用）+ AnalyticsTracer（生产，包装 binding）；
// 双通道用组合 Tracer 同时发。createApp(loader, llm, tracer?) 注入。
```

- **可注入**：`createApp` 增加可选 `tracer` 参数，默认 `ConsoleTracer`（测试用 mock/空实现）。
- **无 binding 不报错**：AnalyticsTracer 在 binding 缺失时降级为只 console.log。
- **失败不阻塞**：trace 异常（如 writeDataPoint 抛错）catch 掉，绝不影响主请求。

**配置**：
- `wrangler.jsonc` 加 `"analytics_engine_datasets": [{ "binding": "ANALYTICS", "dataset": "ai4food-trace" }]`。
- `Env` 类型（`tools/src/server/worker.ts`）加 `ANALYTICS?: AnalyticsDataset`。

**测试**：
- `tracer.test.ts`：验证 ConsoleTracer 输出结构、AnalyticsTracer 调 writeDataPoint 的 indexes/blobs/doubles 映射、双通道 Tracer 同时发、binding 缺失降级、trace 异常不抛。
- `hono.test.ts`：注入 mock tracer，验证路由触发 `http` 事件、AI 路由触发 `ai_*` 事件链。
- 本地（Node）只能验 A 通道；B 通道靠类型 + mock 单测保证，生产 `wrangler tail` 实际验证。

**关键限制已核实**：
- blob 总量上限 **16 KB**（2025-06 提升，文档明确为 "AI inference traces" 场景设计）。`detail` 字段需控制（如 prompt 不全文入，只记长度）。
- Analytics Engine binding **本地不可用**，故本地 = A only，生产 = A+B。

### 1. 数据源改走后端 API

**接口选择**：列表用 `GET /api/restaurants?city=上海&limit=2000`（当前 73 家，一次拉全量在前端做筛选/合并，保留三期交互体验；远期再切服务端分页）。详情页可选改用 `GET /api/restaurants/:id`，但本期详情仍由列表数据提供（避免多次请求），仅当数据缺失时回退到 `/:id`。

**`api.ts` 新增**：
```ts
export async function fetchRestaurants(signal?: AbortSignal): Promise<RestaurantEntry[]>
export async function fetchRestaurantById(id: string, signal?: AbortSignal): Promise<RestaurantEntry | null>
export async function fetchMeta(signal?: AbortSignal): Promise<Meta>
```
返回 `data` 数组；非 2xx 抛 `ApiError`（复用四期已有类）。

**store 改造**：`load()` 调 `fetchRestaurants()`；`stats` 改用 `fetchMeta()` 或本地计算（本期先用本地计算，减少请求，meta 留作后续）。

**缓存与刷新**：浏览器原生 HTTP 缓存 + `stale-while-revalidate` 思路——首次加载后 `loaded=true`；提供手动「刷新」入口（可选）。API Gateway 层已有缓存。

**降级**：API 失败 → `error` 置消息 → ErrorBoundary 显示「数据加载失败 + 重试」。

**环境变量**：`VITE_API_BASE`（已在四期引入，复用）。生产默认 `https://ai4food.635262140.xyz`。

### 2. 筛选条件同步 URL

**同步字段**：`query`(q) / `cuisine` / `price` / `onlyOpen`(open) / `mergeChains`(merge)。映射到 query string，如 `?q=火锅&cuisine=川菜&price=2&open=0&merge=1`。

**双向同步**：
- 状态变 → `router.replace({ query })`（replace 避免每次筛选污染历史）。
- 路由变（前进/后退/外部链接）→ 回填 store。

**新增 `useUrlSync.ts`**：纯函数 `encodeFilters(filters): URLSearchParams` / `decodeFilters(params): Partial<Filters>`，配 Vitest 测试覆盖边界（空值、布尔、缺省）。

**默认值处理**：`onlyOpen` 默认 `true`，URL 中省略 `open` 视为默认 true；显式 `open=0` 才关。

### 3. 加载骨架屏 + 错误边界 + 空态

- **SkeletonCard**：卡片占位，脉冲动画，网格里渲染 6-8 个。
- **ErrorBoundary**（Vue 用 `onErrorCaptured` 或显式 error 状态）：`store.error` 非空时显示「⚠️ 加载失败：{msg}」+「重试」按钮调 `store.load()`。
- **EmptyState**：筛选无结果时显示「没有匹配的餐厅」+「重置筛选」按钮（清空 query/cuisine/price）。

### 4. 智能推荐优化（仅连锁去重；定位推最近已延后）

后端 `/api/ai/recommend` 的候选检索已按城市/菜系/标签放宽。本期做连锁去重：

**连锁去重（前端纯函数，立即生效）**：
对 `picks` 按 `brandKey`（复用 `useChains` 的品牌键逻辑）分组，每个品牌只留 score 最高的一家。新增 `lib/recommend.ts`：
```ts
export function dedupeChainPicks(picks: RecommendPick[]): RecommendPick[]
```
配测试。`AskAi.vue` 展示前去重。

> **定位推最近（4b）已确认延后**到后续期。本期同品牌多分店时，统一用 score 最高兜底，不引入定位权限与 Haversine 逻辑。后续若做，依赖本期 trace 数据观察「同品牌多分店命中」频率，再决定是否值得做。

### 5. 前端标记店铺关闭

**交互**：餐厅详情页加「这家店已关闭？」按钮。点击 → 弹出确认（可选填关店备注）→ 生成该店 frontmatter 的变更草稿（`status: closed`、`tags` 追加「已关店」、`notes` 追加关闭说明、正文标题加「（已关闭）」）→ 跳转 GitHub 在线编辑该文件页，预填新内容。

**`lib/closeDraft.ts`（纯函数）**：
```ts
export function buildClosedMarkdown(entry: RestaurantEntry, reason?: string): string
export function buildGithubEditUrl(entry: RestaurantEntry, newContent: string): string
```
- `buildClosedMarkdown`：复用 `lib/draft.ts` 的 YAML 转义；保留原所有字段，仅改 `status`/`tags`/`notes`/标题。
- `buildGithubEditUrl`：拼 `https://github.com/fgh23333/AI4Food/edit/main/{path}?value=<urlencoded newContent>`（GitHub edit 端点支持 `?value=` 预填）。

配测试覆盖：草稿正确性（status/tags/notes 变更）、URL 编码、原字段保留。

**合规性**：纯客户端生成文本 + 跳转，前端不碰 `data/`，落地仍是人在 GitHub 上点 commit + 开 PR，完全符合铁律。若 `path` 字段缺失（理论上不会，索引都有），降级为跳转新建文件页。

---

## 测试策略

- **纯函数**（`useUrlSync`/`recommend`/`closeDraft` + 后端 `tracer`）：Vitest 单元测试，先写测试再实现（TDD）。
- **API 客户端**：fetch mock（复用 `api.test.ts` 模式）。
- **组件**：`@vue/test-utils` 挂载 SkeletonCard/ErrorBoundary/EmptyState/MarkClosedButton，验证渲染与事件。
- **回归**：现有 31 个前端测试须全绿；`pnpm typecheck && pnpm test && pnpm build`。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Analytics Engine binding 本地不可用 | 本地只走 console.log（A 通道）；B 通道靠类型 + mock 单测，生产 wrangler tail 实测 |
| trace 异常影响主请求 | Tracer 内部全 try/catch，写失败静默 |
| `detail` 超 16KB（如长 prompt 入库） | 只记 promptChars 长度，不记全文；detail 字段有截断兜底 |
| Analytics Engine 产生费用 | writeDataPoint 在免费额度内（百万级/月），本期量极小；监控用量 |
| API 不可达（Workers 故障/CORS） | 错误边界 + 重试；本地联调可用 Node 版 server |
| 前端首次加载变慢（多一次网络） | API Gateway 缓存 + 浏览器缓存；骨架屏缓解感知 |
| GitHub edit URL 的 `?value=` 行为变更 | 用 `closeDraft.test.ts` 固化 URL 形态；若失效降级为复制草稿 |

## 不破坏的接入点

- `schema/`、`tools/` 校验逻辑、`dist/index.json` 结构、后端路由签名均不变。
- 前端切换数据源后，三期所有交互（筛选/搜索/连锁合并/详情）行为保持。
