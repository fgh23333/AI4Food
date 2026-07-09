# AI4Food 二期：后端只读 API 设计文档

- **日期**：2026-07-08
- **状态**：已设计，待审查
- **作者**：fgh23333 + Claude
- **依据**：[ROADMAP 二期](../../ROADMAP.md) · [一期设计](./2026-07-07-data-repo-design.md)

---

## 1. 背景与目标

一期（数据仓库）与三期（前端 SPA）已落地。前端 SPA 当前**直读仓库 `dist/index.json`**（同源 fetch），筛选/搜索全在客户端完成，**没有走任何后端 API**。二期要把一期预留的 Hono 骨架（`tools/src/server/hono.ts`）真正实现为一个**只读查询 API**，并按 ROADMAP 部署到 Cloudflare Workers。

### 本期目标

1. 把现有空壳路由补全为真正可用的查询接口：列表筛选、分页、单条详情、元数据。
2. 让 API 能在 Cloudflare Workers 运行时跑起来并部署上线。
3. 数据源仍是已生成的 `dist/index.json`，**不改数据层、不改 schema、不动贡献流程**。
4. `pnpm server` 从"打印日志的空壳"变成真正可本地联调的 dev server。

### 不在本期范围（后续规划）

- **不做写接口**：本期是只读 API，任何 POST/PUT/DELETE 不实现。
- **不接 LLM / AI 能力**：`/api/ai/*` 仍是预留注释，留给四期。
- **不接前端**：三期前端继续直读 `dist/index.json`，本期不强制前端改走 API（ROADMAP 注明 API 作为四期 AI 的统一接入层，与前端后续合并设计）。
- **不引入 KV / D1 / R2**：数据体积小（当前 ~70KB / 50 条），静态资源绑定即可，无需存储绑定。
- **不做鉴权 / 限流**：公开只读数据，本期不做。

---

## 2. 关键技术决定

| 维度 | 决定 | 理由 |
|------|------|------|
| 运行时 | Cloudflare Workers | 遵 ROADMAP；边缘低延迟；为四期 AI（需密钥/外部调用）铺路 |
| 框架 | Hono（沿用现有） | 已在 `tools/` 依赖里，路由骨架已存在 |
| 数据读取 | **静态资源绑定** `env.ASSETS.fetch()` | Workers 无 Node `fs`；把 `dist/index.json` 作为 Worker 资产绑定，运行时 fetch 自身资产拿 JSON |
| 查询逻辑 | 纯函数，Node 端与 Worker 端共享 | 筛选/分页逻辑与运行时解耦，可用 Vitest 在 Node 下测试 |
| 部署 | Wrangler CLI + 新增 CI workflow | 复用一期 CI 模式（main 合并触发） |
| 代码位置 | `tools/src/server/` 下扩展，新增 Worker 入口 | 保持工具链单一包，避免新 pnpm 包 |

### 为什么用静态资源绑定而非 fs

一期 `loadIndex()` 用 Node `readFileSync` 读 `dist/index.json`，这在 Workers 跑不了。两种解法：

- **(A) 静态资源绑定**（本期选）：`wrangler.jsonc` 里 `[assets].directory = "./dist"`，Worker 运行时 `env.ASSETS.fetch(new Request("http://local/index.json"))` 拿到 `Response`，再 `.json()` 解析。无需 fs，数据随部署自动更新。
- **(B) 构建期内联**：把 `dist/index.json` 在构建时 import 成 JS 模块。代价是数据更新必须重新构建 Worker，且 JSON 体积内联进脚本。本期不选。

(A) 与现有 `build-index.yml` CI 完美契合：CI 提交 `dist/index.json` 后，下次 Worker 部署自动带上最新数据。

---

## 3. API 设计

### 3.1 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/restaurants` | 餐厅列表，支持筛选/分页/排序 |
| GET | `/api/restaurants/:id` | 单条详情（按 id 精确匹配） |
| GET | `/api/meta` | 元数据：总数、城市列表、菜系列表、价位集合 |

所有端点：
- 返回 `application/json; charset=utf-8`
- 错误统一 `{"error": "<message>"}`，HTTP 状态码语义化（400/404/500）
- 不需要鉴权

### 3.2 `GET /api/restaurants` 查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `city` | string | 按城市筛选（精确匹配 frontmatter `city`） |
| `cuisine` | string | 按菜系筛选（精确匹配 `cuisine` 枚举值） |
| `price` | number 1-5 | 按价位筛选（精确匹配 `price_level`） |
| `status` | string | 按状态筛选（`open`/`closed`/`relocated`/`demolished`，默认只返回 `open`？见 3.4） |
| `q` | string | 模糊搜索（匹配 `name`/`address`/`cuisine`/`tags`，大小写不敏感） |
| `tag` | string | 按标签筛选（精确匹配 `tags` 数组中某项） |
| `sort` | string | 排序：`name`（默认）/ `rating`（降序）/ `updated`（降序） |
| `limit` | number | 分页大小，默认 50，最大 200 |
| `offset` | number | 偏移量，默认 0 |

### 3.3 响应格式

**列表**（带分页元信息）：
```json
{
  "data": [ { "...IndexEntry": "..." } ],
  "pagination": {
    "total": 50,
    "limit": 50,
    "offset": 0,
    "returned": 50
  }
}
```

**详情**：直接返回单个 `IndexEntry` 对象（与列表项结构一致），未找到返回 404。

**元数据**：
```json
{
  "total": 50,
  "open": 45,
  "cities": ["上海"],
  "cuisines": ["本帮菜", "西餐", "..."],
  "price_levels": [1, 2, 3, 4, 5]
}
```

> `IndexEntry` 字段与一期 `tools/src/indexer.ts` 完全一致，前端 `RestaurantEntry` 类型已对齐（`frontend/src/types/restaurant.ts` 注释要求两侧同步）。

### 3.4 关于默认 status 过滤的设计抉择

前端 SPA 当前默认隐藏关店餐厅（`onlyOpen` 默认 true）。API 该不该默认也只返回 open？

- **选 A**：API 默认只返回 `status=open`，传 `status=` 空或 `all` 返回全部。
- **选 B**：API 默认返回全部，由调用方显式传 `status=open`。

本期选 **B（默认全部）**：API 是数据层出口，应忠实返回全部数据（含关店历史），筛选职责交给调用方。这与"只读数据 API"定位一致，也避免前端/未来 AI 调用时被隐式过滤坑到。前端如需保持只看 open，显式带 `?status=open`。

---

## 4. 架构与代码结构

```
tools/
├── src/
│   ├── server/
│   │   ├── hono.ts            # 改造：抽出查询逻辑，createApp 接收数据加载函数
│   │   ├── query.ts           # 新增：纯函数查询逻辑（filter/sort/paginate/meta）
│   │   ├── loader.ts          # 新增：数据加载抽象（接口 + Node 实现 + Worker 实现）
│   │   └── worker.ts         # 新增：Worker 入口（default export fetch handler）
│   ├── cli.ts                # 改造：`server` 命令用 @hono/node-server 真正监听端口
│   └── ...（validator/indexer/frontmatter 不动）
├── tests/
│   └── server/
│       ├── query.test.ts     # 新增：查询逻辑单测（核心，TDD）
│       └── hono.test.ts      # 新增：路由集成测试（用 test client）
├── wrangler.jsonc            # 新增：Worker 配置（assets 绑定 dist/）
├── tsconfig.json             # 微调：Workers 代码隔离（见 4.3）
└── package.json              # 新增 deps: @hono/node-server, wrangler（dev）
```

### 4.1 数据加载抽象（`loader.ts`）

```ts
// 数据加载接口：Node 与 Worker 各自实现
export interface DataLoader {
  loadAll(): Promise<IndexEntry[]>
}
```

- **Node 实现**：复用现有 `loadIndex()`（fs 读 `dist/index.json`），包成 async。
- **Worker 实现**：`env.ASSETS.fetch(...)` 拿 `index.json`，`.json()` 解析，带模块级缓存（Worker 实例生命周期内复用，避免每个请求都 fetch 资产）。

`createApp(loader)` 接收 loader，路由 handler 调 `loader.loadAll()` 拿数据后交给 `query.ts` 的纯函数处理。这样 Hono app 与运行时彻底解耦。

### 4.2 查询逻辑（`query.ts`）

纯函数，无 IO，入参 `(entries: IndexEntry[], params: QueryParams)`，出参过滤/排序/分页结果。这是 TDD 的主战场——所有筛选/分页边界用例都在这里覆盖。Node 端测试 = Worker 端行为（同一份代码）。

### 4.3 TypeScript 配置

现有 `tools/tsconfig.json` 有 `types: ["node"]`，Worker 入口不能依赖 node 类型。处理方式：

- 新增 `tools/tsconfig.worker.json`（extends 基础，覆盖 `types: []`，`lib` 加 `WebWorker`，仅 include `src/server/worker.ts`）。
- 主 `tsconfig.json` 继续管 Node 工具链；`pnpm typecheck` 仍只跑主配置。
- Wrangler 自带 `wrangler types` 生成 `worker-configuration.d.ts`（含 `Env` 接口与 `ASSETS` 绑定类型），Worker 入口引用它。

### 4.4 `pnpm server` 改造

从"创建 app 打印路由数"改为用 `@hono/node-server` 真正监听 `http://localhost:8787`，加载 Node 版 loader，打印可用端点。本地可直接 `curl http://localhost:8787/api/restaurants?city=上海` 联调。

---

## 5. 部署与 CI

### 5.1 Wrangler 配置（`tools/wrangler.jsonc`）

```jsonc
{
  "name": "ai4food-api",
  "main": "src/server/worker.ts",
  "compatibility_date": "2026-07-08",
  "assets": {
    "directory": "../../dist",
    "binding": "ASSETS"
  }
}
```

- `assets.directory` 指向仓库根 `dist/`（wrangler 相对 `wrangler.jsonc` 所在目录解析，需 `../../dist`）。
- `ASSETS` 绑定让 Worker 运行时能 fetch `index.json`。
- 部署时 `dist/index.json` 随 Worker 一起上传。

### 5.2 新增 CI workflow：`.github/workflows/deploy-api.yml`

- 触发：push 到 main 且 `dist/index.json` 或 `tools/src/server/**` 或 `tools/wrangler.jsonc` 变动。
- 步骤：checkout → pnpm install → `pnpm typecheck` → `pnpm test` → `pnpm wrangler deploy`（用 `CLOUDFLARE_API_TOKEN` secret）。
- 与现有 `build-index.yml`、`deploy-web.yml` 互不干扰。

### 5.3 所需密钥（用户在 GitHub 配置）

- `CLOUDFLARE_API_TOKEN`：有 Workers 部署权限的 API token。
- `CLOUDFLARE_ACCOUNT_ID`：账号 ID（可放 wrangler.jsonc 或 secret）。

> 部署所需的 Cloudflare 账号与 token 由用户提供；本期代码与 CI 就绪后，首次部署前需用户配置 secret。

---

## 6. 测试策略

遵循 CLAUDE.md 场景 B（工具链开发）的 TDD 要求：

1. **`query.test.ts`（核心单测）**：先写，覆盖
   - 各筛选维度（city/cuisine/price/status/q/tag）的单条件与组合
   - 排序（name/rating/updated）
   - 分页（limit/offset 边界、超限、默认值）
   - meta 计数正确性
2. **`hono.test.ts`（集成测试）**：用 Hono test client，构造假 loader 注入数据，验证 HTTP 层（状态码、查询参数解析、错误响应）。
3. 全绿门槛：`pnpm typecheck && pnpm test && pnpm validate`。

---

## 7. 不破坏现有约束

- `data/` 不动，无生成产物写入 `data/`。
- `schema/` 不动，字段规范不变。
- 前端 `dist/index.json` 读取链路不变（三期前端独立于 API）。
- 一期 CI（validate / build-index / deploy-web）不受影响。
- `.superpowers/` 不提交。
- 分支 `feature/api`，commit 类型 `feat:`（新能力）/ `chore:`（依赖配置）。

---

## 8. 交付物清单

- [ ] `tools/src/server/query.ts` + 测试
- [ ] `tools/src/server/loader.ts`
- [ ] `tools/src/server/hono.ts` 改造
- [ ] `tools/src/server/worker.ts` + `wrangler.jsonc` + `tsconfig.worker.json`
- [ ] `tools/src/cli.ts` `server` 命令改造 + `@hono/node-server` 依赖
- [ ] `tools/tests/server/*.test.ts`
- [ ] `.github/workflows/deploy-api.yml`
- [ ] 文档更新：ROADMAP（二期标 ✅）、README（API 段）、DEVELOPMENT.md（本地 server 联调）
