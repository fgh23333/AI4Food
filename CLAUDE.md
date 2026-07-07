# CLAUDE.md

本文件为 Claude（及其他 AI 助手）在本仓库工作时提供指令。优先级：当前用户指令 > 本文件 > 默认行为。

---

## 项目概述

**AI4Food** 是一个社区共建的**餐厅数据集合（数据仓库）**。核心是一份结构化、可校验、可检索的餐厅/饭店数据集。

- 数据格式：Markdown + YAML frontmatter
- 工具链：TypeScript（pnpm），位于 `tools/`
- Schema：`schema/` 是单一事实来源
- 后端框架（预留）：Hono.js
- 协议：MIT

**本期范围**：数据仓库一期。前端、后端 API、AI 能力均为后续规划，本期只搭骨架与预留接口，**不要实现它们**。

权威设计依据：`docs/superpowers/specs/2026-07-07-data-repo-design.md`
执行计划：`docs/superpowers/plans/2026-07-07-data-repo-bootstrap.md`

---

## 仓库结构速查

```
data/restaurants/{country}/{city}/{slug}.md   # 餐厅数据（人类贡献主战场）
schema/enums.json                              # 枚举表（菜系/价位/状态）
schema/restaurant.schema.json                  # frontmatter JSON Schema（单一事实来源）
tools/                                         # TS 工具链（validator/indexer/cli/...）
dist/index.json                                # 索引产物（CI 生成，可提交）
docs/                                          # 贡献/数据/开发/路线图文档
```

**铁律**：`data/` 只放人类手写数据，生成产物绝不写入 `data/`。改字段只改 `schema/` 一处。

---

## 按任务场景的强制约束

开始任何工作前，先判断属于哪类任务，遵守对应约束。

### 场景 A：餐厅数据贡献（新增/修改/删除 `data/` 下的 md）

1. **改前必读** `docs/DATA_SPEC.md` 与 `data/restaurants/cn/shanghai/_template.md`。
2. frontmatter 必填字段不可缺：`id`, `name`, `city`, `country`, `cuisine`, `price_level`, `status`。
3. `id` 格式 `{country}-{city拼音}-{slug}`，全局唯一，首段必须等于路径 country 目录。
4. 枚举字段（`cuisine`/`price_level`/`status`）只能取 `schema/enums.json` 的值；要加新枚举值，单独提 PR 改 `enums.json`。
5. **提交前必须运行并使其通过**：
   ```bash
   cd tools && pnpm validate && pnpm check-unique
   ```
   有 error 必须修；warning（缺推荐字段）可接受但尽量补全。
6. 文件名规则：`<店名拼音>-<分店>.md`，如 `laoshanghai-nanjingroad.md`。
7. commit 类型必须用 `data:`。
8. `status` 为 `closed`/`demolished` 的餐厅**不要删除**，保留并改状态。

### 场景 B：工具链开发（修改 `tools/` 或 `schema/`）

1. **TDD**：先写失败测试（`tools/tests/`），跑确认失败，再写实现，再跑确认通过。
2. **TypeScript strict**：`tools/tsconfig.json` 已开 `strict` + `noUncheckedIndexedAccess`，不允许 `any` 绕过。
3. 改 schema/校验逻辑**必须配测试用例**；测试用 Vitest（`pnpm test`）。
4. 改完必须全绿：
   ```bash
   cd tools && pnpm typecheck && pnpm test && pnpm validate
   ```
5. 公共导出函数必须有显式参数与返回类型标注。
6. commit 类型：新能力 `feat:`，修 bug `fix:`，依赖/重构/配置 `chore:`。

### 场景 C：文档（修改 `README.md` / `docs/` / 本文件）

1. 内容与 `schema/` 和工具链实际行为保持一致——文档说字段必填，schema 就必须必填。
2. 改完检查无断链、无与 `DATA_SPEC.md` 矛盾的描述。
3. commit 类型用 `docs:`。

---

## 工具链命令（在 `tools/` 目录运行）

| 命令 | 作用 |
|------|------|
| `pnpm validate` | 校验所有餐厅 frontmatter（errors 阻塞 / warnings 提示） |
| `pnpm check-unique` | 校验 id 唯一性与路径一致性 |
| `pnpm index` | 生成 `dist/index.json` |
| `pnpm new` | 交互式生成新餐厅 md（推荐新手） |
| `pnpm server` | Hono 预留空壳（本期仅本地预览，不部署） |
| `pnpm test` | 跑 Vitest 测试 |
| `pnpm typecheck` | TS 类型检查 |

环境：Node 22 + pnpm 10。包管理**只用 pnpm**，不混用 npm/yarn。

---

## Git 规范

**分支（2 种前缀）：**
- `data/<城市>-<店名>` —— 所有餐厅数据贡献
- `feature/<主题>` —— 工具、文档、修复、维护

**commit 类型（5 种，Conventional Commits，中文描述）：**
`feat` / `fix` / `data` / `docs` / `chore`

不要直接推 `main`，开 PR；一条 PR 只做一件事。

---

## 本期不做的事（避免过度实现）

- ❌ 不要实现前端网站（SSG/地图/列表）
- ❌ 不要给 Hono 接入 LLM 或部署 API
- ❌ 不要引入 Git LFS、SSR 框架、monorepo 工具
- ✅ 只维护 `tools/src/server/hono.ts` 的只读路由骨架，为后期预留

如用户要求实现上述内容，先确认是否进入下一期，并提示需要新的设计文档。
