# 路线图

记录后续规划方向。一期的数据仓库与三期的前端 SPA 已落地，其余各期单独设计，一期成果为它们预留了接入点，不会推翻重来。

---

## ✅ 一期：数据仓库（已实现）

- 餐厅数据格式（Markdown + YAML frontmatter）
- 字段规范（JSON Schema 单一事实来源）
- TypeScript 工具链：校验器、索引器、脚手架、Hono 空壳
- CI 自动校验与索引生成
- 贡献流程与文档

## 🔌 二期：后端只读 API

基于已预留的 [`tools/src/server/hono.ts`](../tools/src/server/hono.ts) 骨架，实现只读查询接口：

- `GET /api/restaurants` — 列表（支持城市/菜系/价位筛选）
- `GET /api/restaurants/:id` — 单条详情
- 部署到 Cloudflare Workers

数据来源是已生成的 `dist/index.json`，无需改数据层。

> 注：三期前端已用 SPA 直读 JSON 实现，二期 API 可作为未来 AI 能力（四期）的统一接入层，二者后续会合并设计。

## 🖥️ 三期：前端展示网站（✅ 已实现）

Vue 3 单页应用（SPA），直读已生成的 `dist/index.json`，部署在 GitHub Pages：

- 列表 / 筛选（城市、菜系、价位、营业状态）
- 搜索（店名、菜系、地址、招牌菜、标签）
- 连锁品牌合并展示（可展开各分店）
- 餐厅详情页（frontmatter 结构化字段 + Markdown 探店正文）

线上站点：https://fgh23333.github.io/AI4Food/ 。代码位于 `frontend/`，本地运行见 [README](../README.md) 的「前端」一节。

> 地图视图（基于 `latitude`/`longitude`）在本期设计阶段已明确 descoped，不实现。

## 🤖 四期：AI 能力

基于 Hono API 接入 LLM：

- **智能问答推荐**：自然语言提问（"上海陆家嘴适合商务宴请的粤菜"）→ 基于餐厅数据回答
- **AI 辅助贡献**：自然语言描述 → 自动生成符合 schema 的餐厅 md，降低贡献门槛

LLM 接入点已在 Hono 路由预留（`/api/ai/recommend` 占位），数据层和校验层无需改动。

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
