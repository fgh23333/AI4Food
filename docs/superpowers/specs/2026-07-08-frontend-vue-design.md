# AI4Food 前端展示网站设计文档（三期）

- **日期**：2026-07-08
- **状态**：已设计，待审查
- **作者**：fgh23533 + Claude
- **对应路线图阶段**：ROADMAP 三期「前端展示网站」（部分调整，见下）

---

## 0. 本期定位与范围决策

### 背景与路线图调整

ROADMAP 原把后端 API（二期）排在前端（三期）之前。经本期设计确认，做如下调整：

| 原路线图 | 本期调整 | 理由 |
|---------|---------|------|
| 二期：后端只读 API | **推迟到四期，与 AI 一起做** | 本期前端可直接读已生成的 `dist/index.json`，无需后端中转；后端 API 的真正价值在四期为 AI 提供入口，合并做更内聚 |
| 三期：前端 SSG | 改为 **Vue 3 + Vite SPA** | 团队自用、不考虑 SEO、维护者熟悉 Vue；SSG（Nuxt）复杂度对本场景收益低 |

### 本期范围（三期前端）

- Vue 3 + Vite + TypeScript 的 SPA 工程
- 数据源：构建期/运行期直接 fetch 仓库内已生成的 `dist/index.json`
- 页面：餐厅列表 / 筛选 / 搜索 / 详情
- 部署：GitHub Pages（详见 §6）
- 连锁品牌合并展示（沿用现单页预览已验证的交互）

### 不在本期范围

- ❌ **地图视图**（数据有坐标，但地图渲染层留到后续；本期列表/详情可展示坐标文本与外链）
- ❌ **后端 API**（Hono 只读接口留到四期与 AI 同做）
- ❌ **AI 能力**（四期）
- ❌ **写作/贡献端表单**（贡献仍走 Markdown + PR；前端只读）

> 注：详情页的**探店正文在本期支持**——通过让 indexer 把 md 正文写进 `dist/index.json` 实现（见 §3.1），不需要后端。

---

## 1. 技术选型

| 维度 | 决定 | 理由 |
|------|------|------|
| 框架 | **Vue 3（`<script setup>` + Composition API）** | 维护者熟悉；生态成熟 |
| 构建 | **Vite 6** | Vue 官方推荐，开发体验最好 |
| 语言 | **TypeScript（strict）** | 与 `tools/` 工具链一致；索引类型可复用 |
| 路由 | **Vue Router 4** | SPA 标配，详情页需要 `/restaurants/:id` |
| 状态管理 | **Pinia**（仅一个 store） | 简单、官方；列表筛选/搜索状态集中管理 |
| 样式 | **原生 CSS + CSS 变量**（沿用现预览页暖色变量体系），可选 `<style scoped>` | 团队自用无需 UI 框架开销；保证与现单页预览视觉一致并可平滑迁移 |
| 数据获取 | **原生 `fetch`**（静态 JSON，无需 axios） | 数据是静态文件，`fetch` 足够 |
| Markdown 渲染 | **marked** + **DOMPurify** | 详情页渲染探店正文；轻量、自带 XSS 清洗 |
| 测试 | **Vitest**（与 `tools/` 同） + `@vue/test-utils` | 筛选/搜索逻辑必须有单测 |

**不做**：不引入 UI 组件库（Element Plus/Naive 等）、不引入 SSR/SSG（Nuxt）、不引入地图库。

### 关于现有 `web/index.html` 的处理

Vue 工程上线后**删除** `web/index.html`（单一入口，避免混淆）。删除时机：`frontend/` 构建产物成功部署到 GitHub Pages 并验证后，同 PR 内删除。

---

## 2. 目录结构

前端工程独立于 `tools/`，新建 `frontend/` 目录（不混入 `tools/`，因为 `tools/` 是数据工具链，前端是展示层，职责不同）：

```
AI4Food/
├── frontend/                      # 本期新增：Vue 前端工程
│   ├── package.json               # 独立 package，自己的依赖与脚本
│   ├── tsconfig.json              # strict，extends 一个基础配置
│   ├── vite.config.ts
│   ├── index.html                 # Vite 入口 HTML
│   ├── public/
│   │   └── dist/                  # 软链或构建时拷贝：开发期访问 /dist/index.json
│   └── src/
│       ├── main.ts                # createApp + router + pinia
│       ├── App.vue
│       ├── router/
│       │   └── index.ts           # / → 列表；/restaurants/:id → 详情
│       ├── stores/
│       │   └── restaurants.ts     # Pinia store：加载数据、筛选、搜索
│       ├── types/
│       │   └── restaurant.ts      # 与 tools IndexEntry 对齐的 TS 类型
│       ├── composables/
│       │   ├── useFilter.ts       # 筛选/搜索逻辑（纯函数，可测）
│       │   └── useChains.ts       # 连锁品牌合并逻辑
│       ├── views/
│       │   ├── RestaurantList.vue # 列表页
│       │   └── RestaurantDetail.vue# 详情页
│       ├── components/
│       │   ├── SearchBar.vue
│       │   ├── FilterBar.vue      # 菜系/价位/营业/合并开关
│       │   ├── RestaurantCard.vue # 单店卡片
│       │   ├── ChainCard.vue      # 连锁合并卡片
│       │   ├── BranchList.vue     # 连锁展开的分店列表
│       │   ├── RatingStars.vue
│       │   ├── PriceLevel.vue
│       │   └── StatBar.vue        # 头部统计
│       ├── styles/
│       │   └── tokens.css         # CSS 变量（暖色 + 深色模式）
│       └── tests/
│           ├── useFilter.test.ts
│           └── useChains.test.ts
│
├── tools/                         # 不变
├── data/                          # 不变
├── dist/index.json                # 前端数据源（不变）
├── web/index.html                 # 旧单页预览（迁移后删除，见 §6.3）
└── .github/workflows/
    └── deploy-web.yml             # 改为部署 frontend 构建产物（见 §6）
```

**铁律延续**：`data/` 只放人类手写数据；`dist/index.json` 由工具链生成。前端**只读** `dist/index.json`，绝不写数据。

### 工具链与前端的关系

前端与 `tools/` 是两个独立 pnpm 包（各有 `package.json`），互不安装。前端通过**类型复用**而非代码复用保持与索引结构同步：

- `frontend/src/types/restaurant.ts` 手写一份与 `tools/src/indexer.ts` 的 `IndexEntry` **字段一致**的 interface。
- 在 `tools/` 改了 `IndexEntry` 字段后，前端这份类型需同步（在 §7 的 CI 加一道校验或文档约束，见 §7.2）。

> 之所以不直接 `import` tools 的类型：避免前端工程依赖 tools 包，保持两个包完全解耦、独立构建。

---

## 3. 数据契约（前端 ↔ 索引）

前端读取的 `dist/index.json` 是 `IndexEntry[]`，结构（以真实数据为准）：

```ts
interface RestaurantEntry {
  id: string                    // "cn-shanghai-alilando-jingan"
  name: string                  // "Ali Lando 阿丽兰朵"
  city: string                  // "上海"
  country: string               // "cn"
  cuisine: string               // "西餐"（取自 schema/enums.json）
  price_level: number           // 1-5
  status: string                // open | closed | relocated | demolished
  rating?: number               // 0-5，半分制
  tags?: string[]
  path: string                  // "data/restaurants/cn/shanghai/alilando-jingan.md"
  updated_at?: string           // ISO 日期
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  opening_hours?: Record<string, string>  // { mon: "11:00-22:00", ... }
  recommendations?: { name: string; note?: string }[]
  notes?: string
  description?: string             // 【本期新增】Markdown 正文（探店描述）
}
```

**关键约定**：
- 所有展示字段都是可选的（`?`），前端必须对缺失字段做兜底渲染（如无 rating 不显示星，无 address 不显示地址行）。
- `id` 是路由主键：详情页 `/restaurants/:id`，源文件链接 `${REPO}/blob/main/${path}`。
- 枚举值（cuisine/status）前端**不硬编码列表**，运行期从数据聚合得出（新菜系自动出现在筛选器，与现预览页一致）。

### 3.1 正文进索引（本期数据层改动）

**决定**：把每家餐厅的 Markdown 正文（探店描述）也写进 `dist/index.json`，字段名 `description`。

- **为什么**：详情页需要展示探店正文才有完整体验；既然索引要承载正文，不如一步到位塞进 `index.json`，前端无需再读 md 文件（前端是纯静态、无文件系统，读不了 md）。
- **体积影响**：实测 50 家正文总共仅 2.9KB（单条中位 55 字符），`index.json` 从 59.5KB 增至约 62KB，**无需截断**。
- **改动归属**：这是 `tools/src/indexer.ts` 的改动（场景 B：工具链开发）。
  - `parseFrontmatter` 已返回 `body`（gray-matter 的 `parsed.content`），但 `buildIndex` 当前只取了 frontmatter、丢弃了 body。改动即让 `IndexEntry` 多一个 `description: body` 字段。
  - **必须 TDD**：先写失败测试（断言索引条目含 `description` 且等于正文），再改实现。遵守 CLAUDE.md 场景 B 全部约束（strict、Vitest、改完 `pnpm typecheck && pnpm test && pnpm validate` 全绿）。
- **格式**：`description` 存**原始 Markdown 字符串**（trim 后），前端用轻量 Markdown 渲染（见 §4.2）。
- 类型同步：`tools` 的 `IndexEntry` 与 `frontend` 的 `RestaurantEntry` 都要加 `description?`，CI 校验脚本（§7.2）会兜住漂移。

### 连锁品牌识别（与现预览页对齐）

同一连锁各店 `name` 相同、`id` 的第三段（`cn-shanghai-<brand>-<branch>`）相同：

```ts
function brandKey(r: RestaurantEntry): string {
  return r.id.split('-')[2]  // "chilis" | "pscafe" | ...
}
```

- 拥有 ≥2 家分店的 brand → 合并为一张 `ChainCard`。
- 单店 → 独立 `RestaurantCard`。
- 分店标识从 `address` 剥掉"市/区"得到（如"徐汇万科广场"）。

---

## 4. 页面与功能

### 4.1 列表页 `/`（主页）

**布局**（自上而下）：

1. **Hero 头部**：标题 AI4Food + 副标题 + 统计条（总数 / 营业中 / 菜系数 / 连锁品牌数）。
2. **工具栏**（sticky）：
   - 搜索框：全文匹配 name/cuisine/address/notes/description(正文)/tags/推荐菜名。
   - 菜系下拉：值从数据聚合。
   - 价位下拉：¥ ~ ¥¥¥¥¥。
   - 「仅营业中」开关。
   - 「合并连锁店」开关。
   - 结果计数「显示 N / M 家」。
3. **卡片网格**：`repeat(auto-fill, minmax(336px, 1fr))`。
   - 单店 → `RestaurantCard`：名称、星级、菜系徽标、价位、地址、推荐菜、标签、源文件链接。
   - 连锁 → `ChainCard`：品牌字母章、分店数/营业数/均分/价位区间、合并推荐菜与标签、可展开 `BranchList`。
   - 有搜索/筛选命中时，连锁卡片自动展开（让命中的分店可见）。
4. **空状态**：无匹配时提示调整筛选。

**排序**：默认按评分降序，无评分靠后。

### 4.2 详情页 `/restaurants/:id`

展示单家餐厅完整信息（取自同一个 index 条目，**含正文**——本期已把 md 正文写进索引的 `description` 字段）：

- 名称、星级、菜系、价位、状态徽标。
- 地址（带地图外链：点击跳高德/Google 地图搜索，本期不做内嵌地图）。
- 电话（`tel:` 链接）、营业时间表（周几 → 时段）。
- 推荐菜列表（name + note）。
- 标签。
- notes 点评。
- **探店正文**（`description`，Markdown 渲染）：用轻量 Markdown 渲染。选项：
  - 首选 `marked`（体积小、零配置，~30KB），配 `DOMPurify` 防 XSS（数据是自有仓库 md，风险低，但团队自用也建议过一道清洗）。
  - 正文很短（中位 55 字符），渲染开销可忽略。
- 「查看源文件 →」跳 GitHub md。
- 元信息：updated_at、verified（若索引将来加）。

**404**：id 不存在 → 友好提示 + 回列表链接。

### 4.3 全局

- **响应式**：移动端单列，工具栏折叠。
- **深色模式**：跟随系统 `prefers-color-scheme`（沿用现 tokens）。
- **加载/错误态**：fetch 失败有明确错误提示。

---

## 5. 状态与逻辑设计

### 5.1 Pinia store（`stores/restaurants.ts`）

```ts
// 状态
all: RestaurantEntry[]           // 全量数据
loaded: boolean
error: string | null
// 筛选条件（双向绑定到 FilterBar）
query: string
cuisine: string                  // '' = 全部
price: number                    // 0 = 全部
onlyOpen: boolean
mergeChains: boolean

// getter: 经过筛选+排序后的展示项（单店 | 连锁组）
visible: DisplayItem[]           // DisplayItem = { type:'single', r } | { type:'chain', brand, branches }

// action
load(): Promise<void>            // fetch dist/index.json
```

### 5.2 纯函数逻辑（可单测，放 composables）

- `useFilter`：`(all, {query, cuisine, price, onlyOpen}) => RestaurantEntry[]` —— 纯函数，输入输出确定，Vitest 覆盖。
- `useChains`：`(list, mergeOn) => DisplayItem[]` —— 单店/连锁分组、合并标签推荐菜、均分计算。

> 把筛选与合并逻辑抽成**纯函数**，不依赖 Vue 响应式，是为了可测试——这两块是前端最容易出 bug 的地方。

---

## 6. 部署

### 6.1 方案：GitHub Pages（延续现状）

沿用现 `deploy-web.yml` 的 GitHub Actions 部署思路，改为部署 Vue 构建产物：

1. CI 触发：push 到 `main`，且 `frontend/`、`dist/index.json`、workflow 任一变化。
2. 步骤：
   - `pnpm install`（在 `frontend/`）
   - `pnpm build`（Vite 构建到 `frontend/dist/`）
   - 把 `dist/index.json` 拷进 `frontend/dist/dist/index.json`（前端按 `/dist/index.json` 取数）
   - `upload-pages-artifact` + `deploy-pages`
3. 产物地址：`https://fgh23533.github.io/AI4Food/`

### 6.2 SPA 路由的 base path 与刷新问题

- **base path**：仓库名子路径 `/AI4Food/`，Vite 配 `base: '/AI4Food/'`。
- **刷新 404**：SPA 直接刷新 `/restaurants/xxx` 会 404（GitHub Pages 是静态服务器）。本期采用**.Hash 模式路由**（`/#/restaurants/xxx`）规避——团队自用、不考虑 SEO，hash 模式零成本解决刷新问题，无需额外的 404.html rewrite trick。
  > 若后续需要干净 URL，再切 history 模式 + 404 fallback，本期不做。

### 6.3 旧 `web/index.html` 去留

**决定：删除。** Vue 构建产物上线 GitHub Pages 并验证后，同 PR 内删除 `web/index.html`，保持单一入口。

---

## 7. 质量保障

### 7.1 测试

- **纯函数逻辑必须有单测**（Vitest）：
  - `useFilter`：搜索命中、菜系/价位筛选、onlyOpen 过滤、空结果。
  - `useChains`：≥2 家合并、单店独立、合并标签去重、均分、关店分店标记。
- 组件渲染测试（`@vue/test-utils`）：`RestaurantCard` 对缺失字段兜底、`ChainCard` 展开交互——可选，优先保证纯函数测试。

### 7.2 类型同步约束（含 CI 校验脚本）

`tools` 的 `IndexEntry` 与 `frontend` 的 `RestaurantEntry` 是两份手写类型。为防漂移，本期**实现一个 CI 校验脚本**：

- 脚本位置：`frontend/scripts/check-schema.mjs`（或 `.ts` 由 tsx 跑）。
- 逻辑：读 `dist/index.json` 第一条的 key 集合，对照 `frontend/src/types/restaurant.ts` 里 `RestaurantEntry` 的字段，断言「索引出现的每个 key 都在类型里声明」（允许类型比索引多声明可选字段，但**不允许索引出现类型里没有的 key**）。
- 失败行为：发现未声明字段 → 退出码非零，CI 阻塞，并打印缺失字段名。
- 触发：并入 `frontend` 的 `pnpm check-schema`，在 CI（`deploy-web.yml` 或独立 `frontend-ci.yml`）build 前先跑。
- 同时在 `frontend/src/types/restaurant.ts` 顶部注释标注「与 tools/src/indexer.ts IndexEntry 保持一致，改字段需同步两侧」。

这样 `tools` 一旦给索引加字段，前端 CI 立刻红，强制同步，避免运行时取到 `undefined` 才发现漂移。

### 7.3 工程命令（`frontend/`）

| 命令 | 作用 |
|------|------|
| `pnpm dev` | Vite dev server |
| `pnpm build` | 生产构建 |
| `pnpm test` | Vitest |
| `pnpm typecheck` | `vue-tsc --noEmit` |

环境：Node 22 + pnpm 10（与 tools 一致），只用 pnpm。

---

## 8. 与后续期的衔接

- **四期（后端 API + AI）**：本期前端的 `fetch('/dist/index.json')` 可平滑替换为 `fetch('/api/restaurants')`（后端读同一份索引，含正文）。前端只改数据源 URL，组件不动。
- **地图视图**（后续）：本期详情页已预留坐标展示与外链，未来加内嵌地图只需新增组件，不动数据层。
- **数据层改动范围**：本期**唯一**的数据层改动是 indexer 把正文写进索引（§3.1）；不改 schema、不改校验规则、不改 CI 的 validate 流程（index 流程产物多一个字段，无副作用）。

---

## 9. 已确认的决策（原开放问题，均已拍板）

1. **旧 `web/index.html`**：Vue 上线后**删除**（§6.3）。
2. **详情页正文**：本期把 md 正文写进 `dist/index.json` 的 `description` 字段（§3.1），详情页渲染完整探店正文。这是本期唯一的数据层改动（indexer，TDD）。
3. **类型同步**：实现 CI 校验脚本 `frontend/scripts/check-schema.mjs`，索引字段必须在 `RestaurantEntry` 中声明，否则 CI 阻塞（§7.2）。

## 10. 前端目录命名

新增 `frontend/` 目录（与 `tools/`、`web/`(待删) 平级），独立 pnpm 包。已确认。

---

## 自检

- [x] 覆盖用户决策：Vue SPA / 直读 JSON / 不做地图 / 部署 GitHub Pages / 后端留四期。
- [x] 与现有 `dist/index.json` 真实字段对齐（§3 取自真实数据）。
- [x] 与 ROADMAP 调整已说明理由（§0）。
- [x] 不改数据层/schema/工具链（§8）。
- [x] 与 CLAUDE.md「本期不做前端」的边界冲突已通过「进入下一期 + 新设计文档」机制解决（CLAUDE.md 原文：如用户要求实现上述内容，先确认是否进入下一期，并提示需要新的设计文档——本文件即该文档）。
