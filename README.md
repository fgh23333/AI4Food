# AI4Food 🍽️

> 社区共建的餐厅数据集合（数据仓库）——一份结构化、可校验、可检索的餐厅/饭店数据集。

每个人都能贡献自己探店过的餐厅，数据以 Markdown + YAML frontmatter 存储，通过 TypeScript 工具链自动校验质量，未来可驱动美食推荐网站与 AI 助手。

---

## ✨ 项目特点

- **人机友好的数据格式**：每家餐厅一个 Markdown 文件，frontmatter 存结构化字段，正文写探店描述。
- **单一事实来源**：`schema/` 统一定义字段规范，校验器、文档、未来前端都从这里派生。
- **自动化质量守门**：CI 自动校验必填字段、枚举值、id 唯一性；错误阻塞合并，警告温和提示。
- **低门槛贡献**：只会写 Markdown 也能参与，TypeScript 工具链是透明的黑盒。
- **为未来预留**：Hono API 骨架已就位，前端与 AI 能力可在不推翻数据层的前提下接入。

---

## 📁 仓库结构

```
AI4Food/
├── data/restaurants/{country}/{city}/{slug}.md   # 餐厅数据（贡献主战场）
├── schema/                                        # 字段规范（单一事实来源）
│   ├── restaurant.schema.json
│   └── enums.json
├── tools/                                         # TypeScript 工具链
├── frontend/                                      # Vue 3 SPA 前端（GitHub Pages 部署）
├── dist/index.json                                # 索引产物（CI 生成，前端数据源）
└── docs/                                          # 贡献/数据/开发文档
```

详见 [开发规范](docs/DEVELOPMENT.md)。

---

## 🚀 快速贡献一家餐厅

### 方式一：交互式脚手架（推荐新手）

```bash
git clone https://github.com/fgh23333/AI4Food.git
cd AI4Food/tools
pnpm install
pnpm new          # 回答几个问题，自动生成 md 文件
# 编辑生成的 md，补充正文与推荐菜品
pnpm validate     # 本地校验
```

### 方式二：手写

1. 复制 `data/restaurants/cn/shanghai/_template.md` 到对应城市目录
2. 修改 frontmatter（必填字段不能少）
3. 运行 `pnpm validate` 本地校验
4. 文件命名 `<店名拼音>-<分店>.md`，如 `laoshanghai-nanjingroad.md`
5. 提交 PR，标题 `data: 新增<城市><店名>`

📖 完整流程见 [贡献指南](docs/CONTRIBUTING.md)，字段说明见 [数据规范](docs/DATA_SPEC.md)。

---

## 📋 数据字段速查

| 分级 | 字段 | 说明 |
|------|------|------|
| **必填** | `id`, `name`, `city`, `country`, `cuisine`, `price_level`, `status` | 缺失则校验失败 |
| **推荐** | `address`, `latitude`+`longitude`, `tags`, `updated_at` | 缺失仅警告 |
| **可选** | `rating`, `recommendations`, `notes`, `photos`, `phone`, `opening_hours` | 自由填写 |

示例（老上海饭店南京路店）：

```yaml
---
id: cn-shanghai-laoshanghai-nanjingroad
name: 老上海饭店
city: 上海
country: cn
cuisine: 本帮菜
price_level: 3
status: open
address: 上海市黄浦区南京东路步行街
latitude: 31.2362
longitude: 121.4785
rating: 4.5
updated_at: 2026-06-15
---

# 老上海饭店（南京路店）

本帮菜代表，浓油赤酱……
```

---

## 🛠️ 工具链命令

在 `tools/` 目录下运行（需 Node 22 + pnpm 10）：

| 命令 | 作用 |
|------|------|
| `pnpm validate` | 校验所有餐厅数据 |
| `pnpm check-unique` | 校验 id 唯一性与路径一致性 |
| `pnpm index` | 生成 `dist/index.json` 索引 |
| `pnpm new` | 交互式生成新餐厅文件 |
| `pnpm test` | 运行工具链测试 |
| `pnpm typecheck` | TypeScript 类型检查 |

---

## 🖥️ 前端

仓库内置一个 Vue 3 单页应用（SPA），读取 `dist/index.json` 渲染餐厅列表、筛选、搜索、连锁品牌合并与详情页（含 Markdown 探店正文）。不做地图视图。

**线上**：https://fgh23333.github.io/AI4Food/

**本地预览**（需 Node 22 + pnpm 10）：

```bash
cd frontend
pnpm install
pnpm dev         # 本地开发服务器
pnpm build       # 产物输出到 frontend/dist/
```

前端代码与工具链（`tools/`）相互独立，各自一份 `pnpm` 包。改餐厅数据时无需动前端，CI 会在合并到 `main` 后重建索引并部署 Pages。

---

## 🔌 后端只读 API

基于 Hono 的只读查询 API，部署在 Cloudflare Workers，数据来自 `dist/index.json`（静态资产绑定，运行时无 fs 依赖）。

**线上地址**：`https://ai4food.635262140.xyz`（自定义域；`*.workers.dev` 默认域名在中国大陆不可访问，故绑定自定义域）。

**端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/restaurants` | 列表（`city`/`cuisine`/`price`/`status`/`tag`/`q` 筛选 + `sort` + `limit`/`offset` 分页） |
| GET | `/api/restaurants/:id` | 单条详情 |
| GET | `/api/meta` | 元数据（总数/在营/城市/菜系/价位） |

**本地联调**（见 [开发规范](docs/DEVELOPMENT.md)）：

```bash
cd tools
pnpm run server          # Node 版，http://localhost:8787
# 或
pnpm exec wrangler dev   # Workers 运行时，http://localhost:8788
```

示例：

```bash
curl 'http://localhost:8787/api/restaurants?city=上海&status=open&sort=rating&limit=10'
curl http://localhost:8787/api/restaurants/cn-shanghai-tasty-baiyulan
curl http://localhost:8787/api/meta
```

> 三期前端目前仍直读 `dist/index.json`，本 API 主要服务于四期 AI 能力与未来第三方接入。

---

## 🤖 AI 能力

四期接入 LLM（Cloudflare Workers AI + AI Gateway），提供两个 AI 路由，线上基地址 `https://ai4food.635262140.xyz`：

### 智能问答推荐

```bash
curl -X POST https://ai4food.635262140.xyz/api/ai/recommend \
  -H 'content-type: application/json' \
  -d '{"question":"上海有什么日料推荐"}'
```

返回 `answer`（一句话总结）与 `picks`（1-3 家候选，含 id/名称/理由/相关度）。后端先用规则检索候选（城市/菜系/标签逐级放宽，按评分截断至 30 家），再由 LLM 重排选出最匹配的几家，**反幻觉约束**确保只从数据集里选、不编造餐厅。

### AI 辅助贡献

```bash
curl -X POST https://ai4food.635262140.xyz/api/ai/draft \
  -H 'content-type: application/json' \
  -d '{"description":"愚园路新开的一家本帮菜，人均120，有包间"}'
```

返回符合 schema 的 frontmatter 草稿（含枚举越界 warning）。**仅生成 JSON 供人工核对，不写入 `data/`**，需贡献者按规范补全 id/电话/坐标后提交。

### 前端入口

站点首页 hero 区点击「🤖 问问 AI」或访问 `/#/ask`，支持推荐结果直接跳转餐厅详情、草稿一键复制 frontmatter。

> 模型 `@cf/qwen/qwen3-30b-a3b-fp8`，经 AI Gateway `eatornot` 缓存与限流。本地 `wrangler dev` 调 AI 路由在大陆网络下可能因 miniflare 远程代理超时，可用 REST 直连验证模型可达性。设计详见 [`docs/superpowers/specs/2026-07-09-ai-design.md`](docs/superpowers/specs/2026-07-09-ai-design.md)。

---

## 🗺️ 路线图

**一期（数据仓库）+ 二期（后端只读 API）+ 三期（前端 SPA）+ 四期（AI 能力）已实现**：数据格式、schema、校验工具链、CI、贡献流程，Cloudflare Workers 只读 API，上线 https://fgh23333.github.io/AI4Food/ 的 Vue SPA，以及基于 Workers AI 的智能推荐与 AI 草稿生成。

**后续规划**（见 [ROADMAP](docs/ROADMAP.md)）：
- 🤖 AI 美食助手（智能推荐 + 辅助贡献，基于二期 API 接入 LLM）

一期设计已为后续内容预留接入点，不会推翻重来。

---

## 🤝 参与贡献

欢迎贡献你探店过的餐厅！请先阅读 [贡献指南](docs/CONTRIBUTING.md)。

- 加餐厅 → 分支 `data/<城市>-<店名>`
- 改工具/文档 → 分支 `feature/<主题>`
- commit 类型：`feat` / `fix` / `data` / `docs` / `chore`

---

## 📄 许可证

[MIT](LICENSE)
