# 路线图

记录后续规划方向。每期单独设计，本期（数据仓库一期）的成果为它们预留了接入点，不会推翻重来。

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

## 🖥️ 三期：前端展示网站

静态站点（SSG），渲染：

- **地图视图**：基于餐厅的 `latitude` / `longitude` 字段（一期已支持，地图渲染层留到本期）
- 列表 / 筛选（城市、菜系、价位、评分）
- 餐厅详情页（frontmatter + 正文）

候选技术：Cloudflare Pages / GitHub Pages。技术形态在本期设计时定。

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

本期已为上述各期预留的接入点：

| 接入点 | 位置 | 服务于 |
|--------|------|--------|
| schema 字段 | `schema/restaurant.schema.json` | 前端表单、AI 生成 |
| 索引产物 | `dist/index.json` | 前端数据源、API 数据源 |
| Hono 路由骨架 | `tools/src/server/hono.ts` | 后端 API、AI 接入 |
| 坐标字段 | frontmatter `latitude`/`longitude` | 地图渲染 |
