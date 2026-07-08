# 开发规范

本文档面向维护工具链（`tools/`）和 schema（`schema/`）的开发者。餐厅数据贡献者请看 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 开发环境

- **Node.js** 22+
- **pnpm** 10+
- 平台：Windows / macOS / Linux 均可（代码用正则匹配路径分隔符，跨平台兼容）

```bash
cd tools
pnpm install
```

## 目录职责

```
schema/                    # 单一事实来源（改字段只动这里）
├── restaurant.schema.json # frontmatter JSON Schema (draft-07)
└── enums.json             # 枚举表（cuisines/statuses/priceLevels）

tools/
├── src/
│   ├── types.ts           # 共享类型定义（含 IndexEntry 数据契约）
│   ├── enums.ts           # loadEnums: 从 schema/enums.json 读取
│   ├── frontmatter.ts     # parseFrontmatter + scanRestaurantFiles
│   ├── check-unique.ts    # id 唯一性与路径一致性校验
│   ├── validator.ts       # validateRecord + validateAll（errors/warnings）
│   ├── indexer.ts         # buildIndex + writeIndex + loadIndex
│   ├── new-restaurant.ts  # 交互式脚手架
│   ├── cli.ts             # 命令入口（validate/index/new/server...）
│   └── server/            # 只读查询 API（二期）
│       ├── hono.ts        # Hono app：列表/详情/元数据路由 + 参数校验
│       ├── query.ts       # 纯函数查询逻辑（filter/sort/paginate/meta）
│       ├── loader.ts      # 数据加载抽象 + Worker 实现（资产绑定）
│       ├── loader-node.ts # Node 实现（fs 读 dist/index.json）
│       └── worker.ts      # Cloudflare Workers 入口
├── wrangler.jsonc         # Worker 配置（assets 绑定 dist/）
├── tsconfig.worker.json   # Worker 专用 tsconfig（隔离 node 类型）
└── tests/                 # Vitest 测试 + fixtures
```

**铁律**：`data/` 只放人类手写数据；生成产物（`dist/index.json`）绝不写入 `data/`。

## 工具链命令

| 命令 | 作用 |
|------|------|
| `pnpm run validate` | 校验所有餐厅 frontmatter |
| `pnpm run check-unique` | 校验 id 唯一性与路径一致性 |
| `pnpm run index` | 生成 `dist/index.json` |
| `pnpm run new` | 交互式生成新餐厅 md |
| `pnpm run server` | 启动 Node 版只读 API（本地 `http://localhost:8787`） |
| `pnpm exec wrangler dev` | 启动 Cloudflare Workers 版 API（本地 `http://localhost:8788`，模拟生产运行时） |
| `pnpm exec wrangler types` | 重新生成 `worker-configuration.d.ts`（改 `wrangler.jsonc` 后执行） |
| `pnpm test` | 运行 Vitest 测试 |
| `pnpm typecheck` | TypeScript 类型检查（主 tsconfig，Node 工具链） |

> 注意：用 `pnpm run <cmd>` 而非裸 `pnpm <cmd>`，避免 pnpm CLI 对部分命令名的解析差异。

## 代码规范

- **TypeScript strict**：`tsconfig.json` 开启 `strict: true` 与 `noUncheckedIndexedAccess`。不允许用 `any` 绕过类型。
- **TDD**：先写失败测试，确认 RED，再写实现，确认 GREEN。
- **测试**：核心逻辑放 `tools/tests/`，用 Vitest；改动 schema/校验逻辑必须配测试。
- **公共导出函数**必须有显式参数与返回类型标注。

## errors 与 warnings 分离

校验器输出分两级：

- **error**（阻塞 PR）：必填缺失、枚举非法、id 重复、坐标不成对、日期格式错。
- **warning**（不阻塞）：缺推荐字段（address / 坐标 / tags / updated_at）。

这条原则保证了数据质量底线，又不会因缺推荐字段吓退新手贡献者。新增校验规则时，请明确归入哪一级。

## 本地校验流程

改完工具链后，提交前跑：

```bash
cd tools
pnpm typecheck
pnpm test
pnpm run validate
```

全部通过再提交。

## 本地 API 联调

只读查询 API 有两种本地运行方式（行为一致，数据均来自 `dist/index.json`）：

```bash
cd tools

# 方式一：Node 版（最快，复用 fs 读 dist/index.json）
PORT=8787 pnpm run server

# 方式二：Workers 版（模拟生产 Cloudflare 运行时，含资产绑定）
pnpm exec wrangler dev --port 8788
```

端点示例：

```bash
curl 'http://localhost:8787/api/restaurants?city=上海&status=open&limit=10'
curl http://localhost:8787/api/restaurants/cn-shanghai-tasty-baiyulan
curl http://localhost:8787/api/meta
```

查询参数：`city` / `cuisine` / `price`(1-5) / `status` / `q`(模糊搜索 name/address/cuisine/tags) / `tag` / `sort`(name|rating|updated) / `limit`(≤200) / `offset`。

> 改 `wrangler.jsonc` 的绑定后需重跑 `pnpm exec wrangler types` 刷新类型声明。

## 本期不做的事

- ❌ 不实现前端网站（SSG / 地图 / 列表）—— 三期已用 Vue SPA 实现，地图视图 descoped
- ❌ 不给 API 接入 LLM —— 留给四期（`/api/ai/*` 路由已预留）
- ❌ 不引入 Git LFS、SSR 框架、monorepo 工具

这些属于后续规划，见 [ROADMAP.md](./ROADMAP.md)。
