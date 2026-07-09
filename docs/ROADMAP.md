# 路线图

记录后续规划方向。一期（数据仓库）、二期（后端只读 API）、三期（前端 SPA）、四期（AI 能力）均已落地，其余各期单独设计，前期成果为它们预留了接入点，不会推翻重来。

---

## ✅ 一期：数据仓库（已实现）

- 餐厅数据格式（Markdown + YAML frontmatter）
- 字段规范（JSON Schema 单一事实来源）
- TypeScript 工具链：校验器、索引器、脚手架、Hono 空壳
- CI 自动校验与索引生成
- 贡献流程与文档

## 🔌 二期：后端只读 API（✅ 已实现）

基于已预留的 [`tools/src/server/`](../tools/src/server) 实现 Cloudflare Workers 上的只读查询 API：

- `GET /api/restaurants` — 列表（城市/菜系/价位/状态/标签/模糊搜索筛选 + 排序 + 分页）
- `GET /api/restaurants/:id` — 单条详情
- `GET /api/meta` — 元数据（总数/在营/城市/菜系/价位集合）
- 部署到 Cloudflare Workers，`dist/index.json` 作为静态资产绑定（运行时 fetch，无 fs 依赖）
- **线上地址**：`https://ai4food.635262140.xyz`（自定义域，`*.workers.dev` 在中国大陆不可访问，故绑定自定义域供国内访问）

查询逻辑（`query.ts`）是纯函数，Node 端与 Worker 端共享；`pnpm run server` 可本地 Node 联调，`pnpm exec wrangler dev` 可本地模拟 Workers 运行时。

> 三期前端仍直读 `dist/index.json`，本 API 作为四期 AI 能力的统一接入层，与前端后续合并设计。

## 🖥️ 三期：前端展示网站（✅ 已实现）

Vue 3 单页应用（SPA），直读已生成的 `dist/index.json`，部署在 GitHub Pages：

- 列表 / 筛选（城市、菜系、价位、营业状态）
- 搜索（店名、菜系、地址、招牌菜、标签）
- 连锁品牌合并展示（可展开各分店）
- 餐厅详情页（frontmatter 结构化字段 + Markdown 探店正文）

线上站点：https://fgh23333.github.io/AI4Food/ 。代码位于 `frontend/`，本地运行见 [README](../README.md) 的「前端」一节。

> 地图视图（基于 `latitude`/`longitude`）在本期设计阶段已明确 descoped，不实现。

## 🤖 四期：AI 能力（✅ 已实现）

基于 Hono API 接入 LLM（Cloudflare Workers AI + AI Gateway），两个路由：

- **智能问答推荐** `POST /api/ai/recommend`：自然语言提问（"上海陆家嘴适合商务宴请的粤菜"）→ 规则检索候选（city/cuisine/标签逐级放宽，按评分截断至 30 家）+ LLM 重排 → 从候选集选 1-3 家并给理由，**反幻觉约束**禁止编造不在数据集里的餐厅
- **AI 辅助贡献** `POST /api/ai/draft`：自然语言描述 → 生成符合 schema 的餐厅 frontmatter 草稿（枚举越界置默认 + warning），**仅生成 JSON 供人工核对，不写入 `data/`**

技术栈：
- 模型 `@cf/qwen/qwen3-30b-a3b-fp8`（约 $0.051/$0.34 per M tokens），经 AI Gateway `eatornot` 缓存 + 限流
- `LlmClient` 抽象（测试注入 mock），纯函数检索/编排逻辑（`tools/src/server/ai/`）
- 前端 `AskAi.vue` 视图（`/ask` 路由，列表页 hero 区入口），支持推荐结果跳转详情、草稿复制 frontmatter
- CORS 白名单 `fgh23333.github.io` + localhost

数据层和校验层无需改动，AI 不直接写数据，草稿需人工按贡献规范提交。设计依据见 [`docs/superpowers/specs/2026-07-09-ai-design.md`](superpowers/specs/2026-07-09-ai-design.md)。

---

## 何时启动下一期

每期开始前：

1. 在 `docs/superpowers/specs/` 写新的设计文档
2. 经设计评审与用户确认
3. 再写实现计划执行

本期已为后续各期预留的接入点：

| 接入点 | 位置 | 服务于 |
|--------|------|--------|
| schema 字段 | `schema/restaurant.schema.json` | AI 生成、未来前端表单 |
| 索引产物 | `dist/index.json` | 前端数据源（已接入）、API 数据源 |
| Hono 路由骨架 | `tools/src/server/hono.ts` | 后端 API、AI 接入 |
| 坐标字段 | frontmatter `latitude`/`longitude` | 未来若启用地图视图可直接复用（本期未做） |
