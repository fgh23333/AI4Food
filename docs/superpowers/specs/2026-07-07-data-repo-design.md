# AI4Food 数据仓库设计文档

- **日期**：2026-07-07
- **状态**：已设计，待审查
- **作者**：fgh23333 + Claude

---

## 1. 项目定位

AI4Food 是一个**餐厅数据集合（数据仓库）**开源项目，目标是由社区共同维护一份结构化、可校验、可检索的餐厅/饭店数据集。

### 本期范围（数据仓库一期）

- 餐厅数据的存储格式与目录结构
- 数据字段规范（frontmatter schema，单一事实来源）
- TypeScript 工具链：校验器、索引器、脚手架
- CI 自动校验流程
- 开发规范与贡献流程

### 不在本期范围（后续规划）

- **前端展示网站**（地图/列表/筛选）——技术形态待定
- **后端 API**（基于 Hono.js）——预留接口，本期空壳
- **AI 能力**（智能问答推荐、AI 辅助贡献）——靠后实现

本期所有"预留"部分只搭骨架、不实现，保证后续可无缝接入而不推翻数据层。

### 关键技术决定

| 维度 | 决定 |
|------|------|
| 数据格式 | Markdown + YAML frontmatter |
| 目录组织 | 按地域/城市：`data/restaurants/{国家}/{城市}/{餐厅}.md` |
| 技术栈 | Node.js + TypeScript（pnpm） |
| 后端框架 | Hono.js（预留） |
| 项目结构 | 数据与工具混合型（同仓库） |
| 开源协议 | MIT（已存在） |

---

## 2. 仓库目录结构

```
AI4Food/
├── .github/
│   ├── workflows/
│   │   ├── validate.yml          # PR 时校验所有餐厅数据
│   │   └── build-index.yml       # main 合并后生成 index.json
│   ├── ISSUE_TEMPLATE/
│   │   ├── new-restaurant.md     # 新增餐厅 issue 模板
│   │   └── update-restaurant.md  # 修改餐厅 issue 模板
│   └── PULL_REQUEST_TEMPLATE.md
│
├── data/                         # 核心数据（人类贡献主战场）
│   └── restaurants/
│       └── cn/                   # ISO 国家码
│           └── beijing/          # 城市拼音/英文名
│               ├── _template.md  # 餐厅模板
│               ├── _assets/      # 该城市图片资源
│               └── juqi-sanlitun.md   # 餐厅文件名：店名-分店地区 kebab
│   （data/ 只放人类手写数据；生成产物绝不写入此处）
│
├── schema/                       # 单一事实来源
│   ├── restaurant.schema.json    # frontmatter JSON Schema
│   └── enums.json                # 枚举值（菜系/价位/状态等）
│
├── tools/                        # TS 工具链（pnpm）
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── validator/            # 校验器：读 schema → 校验 data/
│   │   ├── indexer/              # 索引器：扫描 data/ → dist/index.json
│   │   ├── new-restaurant.ts     # 脚手架：问答生成 md 模板
│   │   └── server/               # 预留：Hono API 层（本期空壳）
│   │       └── hono.ts           # 仅导出 app，不接 LLM、不部署
│   └── tests/                    # Vitest 测试
│
├── dist/                         # 生成产物
│   └── index.json                # 索引（前后期前端/AI 读取）
│
├── docs/
│   ├── CONTRIBUTING.md           # 贡献指南
│   ├── DATA_SPEC.md              # 数据字段规范
│   ├── DEVELOPMENT.md            # 开发规范
│   └── ROADMAP.md                # 路线图（前端/AI 一期）
│
├── .editorconfig
├── .gitignore
├── .gitattributes                # 强制 data/ 下 LF + markdown 类型
├── LICENSE                       # MIT（已存在）
└── README.md
```

### 设计要点

- `schema/` 是**单一事实来源**：文档、校验、前端都从此派生，改字段只动一处。
- `data/` 只放人类写的数据；生成产物（index.json）进 `dist/`，绝不污染 `data/`。
- `tools/src/server/hono.ts` 是**预留接口**：本期只定义路由骨架和数据读取，不接 LLM、不部署。

---

## 3. 数据规范（frontmatter schema）

### 3.1 真实示例

```yaml
---
# ============ 基础信息（必填）============
id: cn-beijing-juqi-sanlitun        # 全局唯一，格式：国家-城市-店名-分店
name: 局气
name_en: Juqi
city: 北京
country: cn                          # ISO 3166-1 alpha-2 小写
cuisine: 京菜                         # 见 schema/enums.json
price_level: 3                        # 1-5：人均 ≈ 1:<50 / 2:50-100 / 3:100-200 / 4:200-500 / 5:>500（元）

# ============ 联系与运营 ============
address: 北京市朝阳区工人体育场北路三里屯太古里南区S8-31号
latitude: 39.9342
longitude: 116.4551
phone: "010-12345678"                 # 字符串，避免前导0丢失
website: https://www.xxx.com
opening_hours:
  mon: "11:00-22:00"
  tue: "11:00-22:00"
tags: [商务, 亲子, 网红, 有包间]

# ============ 点评与推荐（主观，可空）============
rating: 4.5                           # 0-5，半分制
visited_date: 2026-06-15
recommendations:                      # 推荐菜品
  - name: 烤鸭
    note: 必点，皮脆
  - name: 炸灌肠
notes: 周末排队久，建议预约；适合带外地朋友体验京菜。
photos:                               # 相对路径，图存 data/.../_assets/
  - ./_assets/juqi-1.jpg

# ============ 数据治理 ============
status: open                          # open | closed | relocated | demolished
verified: true                        # 信息是否经过人工核实
source: 个人探店                       # 来源：个人探店/大众点评/官网/媒体报道
updated_at: 2026-06-15
---

# 局气（三里屯店）

正文区写自由格式的探店描述——这是 Markdown body，
AI 检索和前端展示都会用到。
可以放位置指引、点单攻略、避坑提示等。

## 特色
- 京味儿创意菜
- 环境有老北京元素
```

### 3.2 字段分级与规则

| 分级 | 字段 | 校验规则 |
|------|------|---------|
| **必填** | `id`, `name`, `city`, `country`, `cuisine`, `price_level`, `status` | 缺失 → error，阻塞 |
| **推荐** | `address`, `latitude`+`longitude`（成对）, `tags`, `updated_at` | 缺失 → warning，不阻塞 |
| **可选** | 点评、推荐菜、图片、电话、网站、营业时间 | 完全自由 |

### 3.3 关键约束

- `id` 全局唯一，命名规范 `{country}-{city}-{slug}`，CI 校验唯一性，且 `id` 与文件路径一致。
- `latitude` / `longitude` 必须成对出现且范围合法（-90~90 / -180~180）。
- `cuisine` / `status` / `price_level` 取**枚举值**，自由填值报 error。枚举表 `schema/enums.json` 可被 PR 扩充。
- `phone` 强制字符串类型。
- `updated_at` 必须是 ISO 日期（`YYYY-MM-DD`）。
- **errors 与 warnings 分离**：errors 阻塞 PR；warnings 仅评论提示，允许合并。

### 3.4 城市处理

城市**不在 schema 强制枚举**（城市太多会阻塞新地区贡献）。改用：
- 城市用自由字符串
- 文件路径强约束：路径里的城市目录名必须等于 frontmatter 的 `city` 字段

这样既灵活又自洽。

---

## 4. 工具链与 CI 流程

### 4.1 工具链命令（`tools/`）

| 命令 | 作用 | 何时用 |
|------|------|--------|
| `pnpm validate` | 扫描 `data/`，用 `schema/` 校验每个 md 的 frontmatter，输出 errors/warnings | 本地开发 + CI |
| `pnpm index` | 扫描 `data/` → 生成 `dist/index.json` | CI（main 合并后） |
| `pnpm new` | 交互式问答 → 在正确目录生成填好 frontmatter 的 md | 贡献者本地加餐厅 |
| `pnpm check-unique` | 校验所有 `id` 全局唯一、文件名与 id 一致 | CI |
| `pnpm server` | 预留：启动 Hono dev server（本期只读数据返回 JSON）。**本期为可选项**，可不实现；若实现也仅用于本地预览，不进 CI、不部署 | 后期 AI/前端联调 |

### 4.2 数据流

```
贡献者写 data/restaurants/cn/beijing/xxx.md
          │
          ▼  (PR 触发)
   ┌─────────────┐     ┌─────────────┐
   │  validate   │────▶│ check-unique│   errors → 阻塞 PR
   └─────────────┘     └─────────────┘
          │ warnings → 评论提示，不阻塞
          ▼  (合并到 main 触发)
   ┌─────────────┐
   │   index     │────▶ dist/index.json   (供未来前端/AI 读取)
   └─────────────┘
```

**errors 与 warnings 分离**是关键：必填字段错误、枚举值非法、id 重复 → errors 阻塞；缺推荐字段、缺图片 → warnings 仅提示。新手贡献者不会被吓退，同时保证数据质量底线。

### 4.3 Hono 预留接口（本期空壳）

```ts
// tools/src/server/hono.ts —— 本期只定义骨架，不接 LLM
import { Hono } from 'hono'
import { loadIndex } from '../indexer'

const app = new Hono()

// 只读数据 API，为后期前端/AI 打地基
app.get('/api/restaurants', (c) => c.json(loadIndex()))
app.get('/api/restaurants/:id', (c) => /* 按 id 查 */)
// 预留 app.post('/api/ai/recommend', ...)  ← 下一期接入 LLM

export default app
```

**为什么现在就放 Hono 空壳**：让"API 层"在仓库有明确归属，后期接 AI/LLM 时直接在已有路由上加 handler，不用动数据层和校验层。本期它不部署、不进 CI、不影响数据贡献。

### 4.4 CI（`.github/workflows/`）

- **`validate.yml`**（PR 触发）：`pnpm install` → `validate` → `check-unique`。失败阻塞合并。
- **`build-index.yml`**（main 合并触发）：`index` → 提交 `dist/index.json` 回仓库（保证前端可直接 fetch；若后期仓库体积过大再改为 Release，本期不纠结）。

---

## 5. 开发规范与贡献流程

### 5.1 分支与 Commit 规范（GitHub Flow）

**分支（2 种前缀）：**

| 分支 | 用途 | 示例 |
|------|------|------|
| `data/<城市>-<店名>` | 所有餐厅数据贡献（增/改/删） | `data/beijing-juqi` |
| `feature/<主题>` | 其他一切（工具、文档、修复、维护） | `feature/fix-validator`、`feature/contributing-doc` |

**Commit 类型（5 种，Conventional Commits）：**

| 类型 | 含义 | 用法 |
|------|------|------|
| `feat` | 新功能 | 工具链/schema/CI 新增能力 |
| `fix` | 修复 bug（含紧急修复） | 校验逻辑、CI 报错等 |
| `data` | 餐厅数据的增/改/删 | `data/` 下的 md 变动 |
| `docs` | 文档与规范 | README、CONTRIBUTING、DATA_SPEC |
| `chore` | 杂项维护 | 依赖升级、格式、重构、测试、CI 配置 |

**规则：**
- 直接在 `main` 上提交需开 PR；一条 PR 尽量只做一件事（加餐厅就只加餐厅，别混着改工具）。
- 变更性质靠 commit 类型表达，不靠分支前缀承担。

**示例：**
```
分支 data/beijing-juqi          →  data: 新增北京局气三里屯店
分支 feature/fix-validator      →  fix: 修复 longitude 越界未报错
分支 feature/contributing-doc   →  docs: 补充贡献流程
```

### 5.2 贡献一条龙（贡献者视角）

面向"只会写 Markdown 的人"，提供两条路径：

**路径 A（推荐新手）：用脚手架**
```
git clone → pnpm install → pnpm new
# 回答几个问题（店名/城市/菜系...）→ 自动生成正确目录下的 md
→ 填正文 → pnpm validate（本地先验）→ 提 PR
```

**路径 B：手写**
1. 复制 `data/restaurants/cn/beijing/_template.md` 到对应城市目录
2. 改 frontmatter（必填字段必填）
3. `pnpm validate` 本地校验
4. 文件名规则：`<店名拼音>-<分店>.md`，如 `juqi-sanlitun.md`
5. 提 PR，标题 `data: 新增<城市><店名>`

**贡献者完全不需要会 TypeScript**——TS 只在工具链里，对数据贡献者是黑盒。

### 5.3 PR 审核清单

PR 模板自带 checklist，维护者按此 review：

```
- [ ] id 唯一且与文件路径一致
- [ ] 必填字段完整（name/city/country/cuisine/price_level/status）
- [ ] 坐标在中国境内且成对（若填了）
- [ ] cuisine/status/price_level 用了枚举值
- [ ] updated_at 已填写
- [ ] 正文有探店描述（非空 body）
- [ ] CI validate 通过
```

### 5.4 代码规范（针对工具链 TS 代码）

数据贡献者不涉及，但维护工具链时遵守：
- **ESLint + Prettier**：统一风格，CI 检查。
- **TypeScript strict 模式**：`tsconfig.json` 开 `strict: true`。
- **测试**：核心校验/index 逻辑放 `tools/tests/`，用 Vitest，CI 跑测试。
- **`tools/` 改动需有测试**：schema/校验逻辑改动必须配测试用例。

### 5.5 数据治理约定

- **信息时效性**：`status: closed` / `demolished` 的餐厅不删除，保留并改状态（保留历史）。
- **去重**：同店不同分店是不同 `id`（带分店后缀）；同分店禁止重复文件。
- **冲突仲裁**：主观字段（rating/notes）以最近更新者为准；客观字段（地址/电话）以 `verified: true` 来源优先。
- **图片**：小图直接存 `data/.../_assets/`，大图走外链。本期不引入 Git LFS。

---

## 6. 后续路线图（不在本期实现）

仅记录规划方向，待下一期专门设计：

1. **前端一期**：静态站点（SSG），渲染地图/列表/筛选，部署 Cloudflare Pages 或 GitHub Pages。技术形态待定。
2. **后端 API 一期**：基于已预留的 Hono 骨架实现只读查询接口。
3. **AI 一期**：基于 Hono 接入 LLM，实现智能问答推荐 + AI 辅助贡献（自然语言生成符合 schema 的 md）。

本期的设计（schema/校验/索引/Hono 空壳）为上述全部内容预留了接入点，不会推翻重来。
