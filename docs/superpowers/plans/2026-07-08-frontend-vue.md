# AI4Food 前端展示网站（三期）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有的单文件 HTML 预览页升级为一个 Vue 3 + Vite 的 SPA 工程，读 `dist/index.json` 渲染列表/筛选/搜索/详情（含正文），部署到 GitHub Pages，并删除旧预览页。

**Architecture:** 独立 `frontend/` 目录（自己的 pnpm 包，与 `tools/` 解耦）。数据流：`data/*.md` →（`tools` indexer，本期新增 `description` 字段）→ `dist/index.json` →（frontend `fetch`）→ Vue 组件。筛选/合并逻辑抽成纯函数（Vitest 覆盖）。详情页正文用 marked + DOMPurify 渲染。SPA 用 hash 路由规避 GitHub Pages 刷新 404。

**Tech Stack:** Vue 3 (`<script setup>`)、Vite 6、TypeScript (strict)、Vue Router 4 (hash 模式)、Pinia、marked + DOMPurify、Vitest + @vue/test-utils。Node 22 + pnpm 10。

## Global Constraints

（摘自 spec 与 CLAUDE.md，每个任务的隐含前提）

- `data/` 只放人类手写数据；生成产物（含 `dist/index.json`）绝不写入 `data/`。
- 改 `tools/` 或 `schema/` 必须遵守 CLAUDE.md 场景 B：**TDD**（先写失败测试→跑确认失败→实现→跑确认通过）、**TypeScript strict + `noUncheckedIndexedAccess`**（不允许 `any`）、改完必须全绿：`cd tools && pnpm typecheck && pnpm test && pnpm validate`。
- 包管理**只用 pnpm 10**，Node 22。两个包（`tools/`、`frontend/`）各自独立 `pnpm install`，互不依赖。
- commit 类型（Conventional Commits）：新能力 `feat:`、修 bug `fix:`、依赖/重构/配置/CI `chore:`、文档 `docs:`。commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- 所有 GitHub Actions 用最新稳定 major（消 Node 20 弃用警告）：`actions/checkout@v5`、`actions/setup-node@v5`、`actions/configure-pages@v6`、`actions/upload-pages-artifact@v5`、`actions/deploy-pages@v5`、`pnpm/action-setup@v4`。
- 前端类型 `RestaurantEntry`（`frontend/src/types/restaurant.ts`）必须与 `tools` 的 `IndexEntry`（`tools/src/indexer.ts`）字段一致；CI 校验脚本兜底防漂移（Task 3）。

---

## File Structure（本期新增/改动全景）

```
AI4Food/
├── tools/src/indexer.ts              # Task 1: IndexEntry + buildIndex 加 description
├── tools/tests/indexer.test.ts       # Task 1: 加正文断言测试
├── frontend/                         # Task 2~9: 新建 Vue 工程
│   ├── package.json
│   ├── tsconfig.json / tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── env.d.ts
│   ├── .gitignore
│   ├── public/                       # dev 期软链/拷贝 dist
│   ├── scripts/check-schema.mjs      # Task 3: 漂移校验
│   └── src/
│       ├── main.ts                   # Task 4
│       ├── App.vue                   # Task 4
│       ├── router/index.ts           # Task 4
│       ├── stores/restaurants.ts     # Task 4
│       ├── types/restaurant.ts       # Task 3
│       ├── composables/useFilter.ts  # Task 5
│       ├── composables/useChains.ts  # Task 5
│       ├── views/RestaurantList.vue  # Task 7
│       ├── views/RestaurantDetail.vue# Task 8
│       ├── components/*.vue          # Task 6/7/8
│       ├── styles/tokens.css         # Task 6
│       ├── lib/markdown.ts           # Task 8 (marked+DOMPurify 封装)
│       └── tests/*.test.ts           # Task 5
├── .github/workflows/
│   ├── deploy-web.yml                # Task 9: 改为部署 frontend 产物
│   ├── build-index.yml               # Task 9: 升 action 版本
│   └── validate.yml                  # Task 9: 升 action 版本
└── web/index.html                    # Task 10: 删除
```

---

## Task 1: indexer 把 Markdown 正文写进索引（TDD，场景 B）

**Files:**
- Modify: `tools/src/indexer.ts`（`IndexEntry` 接口 + `buildIndex` 的 entry 对象）
- Test: `tools/tests/indexer.test.ts`

**Interfaces:**
- Produces: `IndexEntry` 新增可选字段 `description?: string`（trim 后的 md 正文）。下游：`dist/index.json` 多一个 key，frontend `RestaurantEntry` 同步声明。

- [ ] **Step 1: 写失败测试**

在 `tools/tests/indexer.test.ts` 的 `describe('buildIndex')` 块内追加（紧跟现有"索引包含展示用扩展字段"测试之后）：

```typescript
  it('索引包含正文字段 description（trim 后的 Markdown 正文）', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    const entry = index.find((e) => e.id === 'cn-shanghai-test-shop')!
    expect(entry.description).toBe('正文内容。')
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd tools && pnpm test
```
Expected: 新测试 FAIL（`entry.description` 为 `undefined`，期望 `'正文内容。'`）。

- [ ] **Step 3: 改实现**

在 `tools/src/indexer.ts` 的 `IndexEntry` 接口，紧跟 `notes?: string` 之后加：

```typescript
  description?: string
```

在 `buildIndex` 函数内，`parseFrontmatter(file)` 返回值需同时取 `body`。当前代码是：

```typescript
    const { frontmatter: fm } = parseFrontmatter(file)
```

改为：

```typescript
    const { frontmatter: fm, body } = parseFrontmatter(file)
```

然后在 entry 对象里，`notes: fm.notes,` 之后加一行：

```typescript
      description: body.trim(),
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd tools && pnpm test
```
Expected: 全部 PASS（5 个测试文件、原 17 个测试 + 新 1 个）。

- [ ] **Step 5: 全量校验 + 重新生成索引**

```bash
cd tools && pnpm typecheck && pnpm test && pnpm validate && pnpm run index
```
Expected: typecheck 0 error；test 全绿；validate 0 error；`dist/index.json` 每个条目多出 `description` 字段。

- [ ] **Step 6: 人工抽查索引产物**

```bash
node -e "const d=require('./dist/index.json');const e=d.find(x=>x.id==='cn-shanghai-alilando-jingan');console.log('description:',JSON.stringify(e.description))"
```
Expected: 打印该餐厅的正文（非 undefined）。

- [ ] **Step 7: 提交**

```bash
git add tools/src/indexer.ts tools/tests/indexer.test.ts dist/index.json
git commit -m "feat(indexer): 索引纳入 Markdown 正文 description 字段

为三期前端详情页展示探店正文做准备；正文取自 gray-matter 的 body。
新增对应 Vitest 测试。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: frontend 工程脚手架

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/env.d.ts`, `frontend/.gitignore`, `frontend/src/main.ts`, `frontend/src/App.vue`（最小占位）

**Interfaces:**
- Produces: 一个能 `pnpm dev` 启动的空 Vue 工程（白页 + "AI4Food" 标题），`pnpm build` 能产出 `frontend/dist/`，`pnpm typecheck` 0 error。

- [ ] **Step 1: 创建 `frontend/package.json`**

```json
{
  "name": "@ai4food/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "vue-tsc --noEmit",
    "check-schema": "node scripts/check-schema.mjs"
  },
  "dependencies": {
    "dompurify": "^3.2.0",
    "marked": "^14.1.0",
    "pinia": "^2.2.0",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.5",
    "@vitejs/plugin-vue": "^5.1.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.1.0"
  }
}
```

> 注：`@types/dompurify` 在 dompurify 3.x 可能已自带类型；若 `pnpm typecheck` 报重复声明，删掉这个 devDependency。Task 8 处理。

- [ ] **Step 2: 创建 `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "preserve",
    "useDefineForClassFields": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "env.d.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: 创建 `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

> 此文件引用 `node` 类型供 `vite.config.ts` 使用；`@types/node` 通过 vite 的传递依赖可用。若 typecheck 报缺 node 类型，在 devDependencies 加 `"@types/node": "^22.5.0"`。

- [ ] **Step 4: 创建 `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // 仓库名子路径；GitHub Pages 部署在 /AI4Food/ 下
  base: '/AI4Food/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 5: 创建 `frontend/env.d.ts`**

```typescript
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
```

- [ ] **Step 6: 创建 `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI4Food · 上海餐厅图鉴</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: 创建 `frontend/.gitignore`**

```
node_modules
dist
*.local
```

- [ ] **Step 8: 创建 `frontend/src/main.ts`**（最小：只挂载 App，router/pinia 在 Task 4 接入）

```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 9: 创建 `frontend/src/App.vue`**（占位）

```vue
<script setup lang="ts"></script>

<template>
  <div class="placeholder">
    <h1>🍽️ AI4Food</h1>
    <p>前端工程脚手架就绪。</p>
  </div>
</template>

<style scoped>
.placeholder { padding: 40px; text-align: center; }
</style>
```

- [ ] **Step 10: 安装依赖并验证**

```bash
cd frontend && pnpm install
```
Expected: 安装成功，生成 `pnpm-lock.yaml`。

```bash
cd frontend && pnpm typecheck && pnpm build
```
Expected: typecheck 0 error；`build` 产出 `frontend/dist/index.html` 等。

```bash
cd frontend && pnpm dev
```
手动在浏览器打开 `http://localhost:5173/AI4Food/`（注意 base path），确认看到占位页。Ctrl+C 停止。

- [ ] **Step 11: 提交**

```bash
git add frontend/
git commit -m "feat(frontend): 初始化 Vue3+Vite+TS 工程脚手架

独立 pnpm 包 @ai4food/frontend；base path /AI4Food/；@ 别名指向 src。
dev/build/typecheck 均通过。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 类型定义 + 漂移校验脚本

**Files:**
- Create: `frontend/src/types/restaurant.ts`
- Create: `frontend/scripts/check-schema.mjs`

**Interfaces:**
- Produces: `RestaurantEntry` 类型（与 `tools` 的 `IndexEntry` 字段对齐，含 `description`）；`check-schema` 脚本读 `dist/index.json` 校验 key 集合，跑通 `pnpm check-schema`。

- [ ] **Step 1: 创建 `frontend/src/types/restaurant.ts`**

```typescript
// ⚠️ 与 tools/src/indexer.ts 的 IndexEntry 保持一致；改字段需同步两侧。
// CI 脚本 scripts/check-schema.mjs 会校验索引 key 是本类型的子集。

export interface Recommendation {
  name: string
  note?: string
}

export interface RestaurantEntry {
  id: string
  name: string
  city: string
  country: string
  cuisine: string
  price_level: number
  status: string
  rating?: number
  tags?: string[]
  path: string
  updated_at?: string
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  opening_hours?: Record<string, string>
  recommendations?: Recommendation[]
  notes?: string
  description?: string
}

// 展示用联合类型：单店 | 连锁组（见 useChains）
export type ChainBrand = {
  key: string
  name: string
  cuisine: string
  branches: RestaurantEntry[]
}
export type DisplayItem =
  | { type: 'single'; entry: RestaurantEntry }
  | { type: 'chain'; brand: ChainBrand }
```

- [ ] **Step 2: 创建 `frontend/scripts/check-schema.mjs`**

```javascript
// 校验 dist/index.json 的每个 key 都在 RestaurantEntry 类型中声明。
// 用正则从 types/restaurant.ts 提取声明的字段名（足够本项目规模，无需 TS Compiler API）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const typeSrc = readFileSync(resolve(root, 'src/types/restaurant.ts'), 'utf-8')
// 抓 RestaurantEntry 接口体里的字段名（顶层，忽略嵌套 interface）
const ifaceMatch = typeSrc.match(/export interface RestaurantEntry \{([\s\S]*?)\}/)
if (!ifaceMatch) {
  console.error('✗ 找不到 RestaurantEntry 接口')
  process.exit(1)
}
const declared = new Set(
  [...ifaceMatch[1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1])
)

const index = JSON.parse(readFileSync(resolve(root, '..', 'dist', 'index.json'), 'utf-8'))
if (!Array.isArray(index) || index.length === 0) {
  console.error('✗ dist/index.json 为空或非数组')
  process.exit(1)
}

const sampleKeys = Object.keys(index[0])
const missing = sampleKeys.filter((k) => !declared.has(k))

if (missing.length > 0) {
  console.error(`✗ 索引存在 RestaurantEntry 未声明的字段: ${missing.join(', ')}`)
  console.error('  请在 frontend/src/types/restaurant.ts 补声明，或确认 tools/indexer 改动。')
  process.exit(1)
}
console.log(`✓ 类型同步检查通过（索引 ${sampleKeys.length} 个字段均已声明）`)
```

- [ ] **Step 3: 跑脚本确认通过**

```bash
cd frontend && pnpm check-schema
```
Expected: 打印 `✓ 类型同步检查通过（索引 N 个字段均已声明）`，退出码 0。

- [ ] **Step 4: 反向验证脚本能抓错（临时破坏后还原）**

临时在 `tools/src/indexer.ts` 的 entry 对象加一个假字段 `__bogus: 1`（并在 `IndexEntry` 接口加 `__bogus?: number`），跑 `cd tools && pnpm run index`，再跑 `cd frontend && pnpm check-schema`，确认报 `✗ 索引存在未声明字段: __bogus`。**验证后用 git 还原**：

```bash
cd .. && git checkout -- tools/src/indexer.ts && cd tools && pnpm run index
```

- [ ] **Step 5: typecheck 确认**

```bash
cd frontend && pnpm typecheck
```
Expected: 0 error。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/types/restaurant.ts frontend/scripts/check-schema.mjs
git commit -m "feat(frontend): 类型定义 + 索引/类型漂移校验脚本

RestaurantEntry 与 tools IndexEntry 对齐(含 description)；
check-schema.mjs 校验 dist/index.json 的 key 是类型的子集，
tools 加字段未同步时 CI 阻塞。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Router + Pinia store + 数据加载

**Files:**
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/stores/restaurants.ts`
- Modify: `frontend/src/main.ts`（接 router + pinia）
- Modify: `frontend/src/App.vue`（挂 `<router-view>`）
- Create: `frontend/src/views/RestaurantList.vue`（占位）
- Create: `frontend/src/views/RestaurantDetail.vue`（占位）

**Interfaces:**
- Consumes: `RestaurantEntry`（Task 3）
- Produces: `useRestaurantsStore`（state: all/loaded/error/query/cuisine/price/onlyOpen/mergeChains；action: load）；路由 `/` → 列表，`/restaurants/:id` → 详情，hash 模式。

- [ ] **Step 1: 创建 `frontend/src/router/index.ts`**

```typescript
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'list', component: () => import('@/views/RestaurantList.vue') },
    {
      path: '/restaurants/:id',
      name: 'detail',
      component: () => import('@/views/RestaurantDetail.vue'),
      props: true,
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
```

- [ ] **Step 2: 创建 `frontend/src/stores/restaurants.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'

export const useRestaurantsStore = defineStore('restaurants', () => {
  const all = ref<RestaurantEntry[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const query = ref('')
  const cuisine = ref('')
  const price = ref(0)
  const onlyOpen = ref(true)
  const mergeChains = ref(true)

  async function load(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}dist/index.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as RestaurantEntry[]
      all.value = Array.isArray(data) ? data : []
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      loaded.value = true
    }
  }

  return { all, loaded, error, query, cuisine, price, onlyOpen, mergeChains, load }
})
```

- [ ] **Step 3: 改 `frontend/src/main.ts`**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 4: 改 `frontend/src/App.vue`**

```vue
<script setup lang="ts"></script>

<template>
  <router-view />
</template>
```

- [ ] **Step 5: 创建占位 `frontend/src/views/RestaurantList.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRestaurantsStore } from '@/stores/restaurants'

const store = useRestaurantsStore()
onMounted(() => store.load())
</script>

<template>
  <div class="placeholder">
    <p>已加载 {{ store.all.length }} 家；错误：{{ store.error ?? '无' }}</p>
  </div>
</template>

<style scoped>
.placeholder { padding: 40px; }
</style>
```

- [ ] **Step 6: 创建占位 `frontend/src/views/RestaurantDetail.vue`**

```vue
<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <div class="placeholder">详情页占位：{{ id }}</div>
</template>

<style scoped>
.placeholder { padding: 40px; }
</style>
```

- [ ] **Step 7: dev 验证数据加载 + 路由**

为了让 dev 期能 fetch 到 `dist/index.json`，建立 `frontend/public/dist` → 仓库根 `dist` 的链接。在 Windows 用目录拷贝（dev 期；构建期由 CI 拷真文件）。临时做法：

```bash
cd frontend && mkdir -p public && cp -r ../dist public/dist
```
（`.gitignore` 已忽略不了这个拷贝；Task 9 的 CI 会自己拷。本地 dev 用即可，**不要 commit `frontend/public/dist`**——在 Step 9 的提交前删掉或加进 gitignore。实际：把 `public/dist` 加入 `frontend/.gitignore`。）

更新 `frontend/.gitignore`，追加：

```
public/dist
```

```bash
cd frontend && pnpm dev
```
浏览器开 `http://localhost:5173/AI4Food/`，确认占位页显示"已加载 50 家；错误：无"。访问 `http://localhost:5173/AI4Food/#/restaurants/cn-shanghai-alilando-jingan` 确认详情占位。Ctrl+C。

- [ ] **Step 8: typecheck + build**

```bash
cd frontend && pnpm typecheck && pnpm build
```
Expected: 0 error，`build` 产出 `dist/`。

- [ ] **Step 9: 提交**

```bash
git add frontend/src frontend/.gitignore
git commit -m "feat(frontend): 接入 router(hash) + Pinia store + 数据加载

/  列表(占位)、/restaurants/:id 详情(占位)；store fetch dist/index.json。
public/dist(本地 dev 拷贝)已加入 gitignore。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 纯函数逻辑（useFilter / useChains）+ 单元测试

**Files:**
- Create: `frontend/src/composables/useFilter.ts`
- Create: `frontend/src/composables/useChains.ts`
- Create: `frontend/src/tests/useFilter.test.ts`
- Create: `frontend/src/tests/useChains.test.ts`

**Interfaces:**
- Consumes: `RestaurantEntry`, `DisplayItem`, `ChainBrand`（Task 3）
- Produces:
  - `filterRestaurants(all, { query, cuisine, price, onlyOpen }): RestaurantEntry[]`
  - `toDisplayItems(list, mergeChains): DisplayItem[]`
  - `brandKey(entry): string`、`branchClosed(entry): boolean`、`branchLabel(entry): string`、`specialTag(entry): string`、`averageRating(entries): number | null`

- [ ] **Step 1: 写 `useFilter.test.ts`（先失败）**

```typescript
import { describe, it, expect } from 'vitest'
import { filterRestaurants } from '@/composables/useFilter'
import type { RestaurantEntry } from '@/types/restaurant'

const mk = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试', city: '上海', country: 'cn',
  cuisine: '西餐', price_level: 2, status: 'open', ...over,
})

describe('filterRestaurants', () => {
  const data: RestaurantEntry[] = [
    mk({ id: 'cn-shanghai-a', name: '甲店', cuisine: '西餐', price_level: 2, status: 'open', tags: ['汉堡'], recommendations: [{ name: '安格斯' }] }),
    mk({ id: 'cn-shanghai-b', name: '乙店', cuisine: '火锅', price_level: 3, status: 'closed' }),
    mk({ id: 'cn-shanghai-c', name: '丙店', cuisine: '西餐', price_level: 4, status: 'open', address: '南京路', notes: '环境好' }),
  ]

  it('onlyOpen 过滤掉非营业', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '', price: 0, onlyOpen: true })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-a', 'cn-shanghai-c'])
  })
  it('cuisine 筛选', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '火锅', price: 0, onlyOpen: false })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-b'])
  })
  it('price 筛选', () => {
    const r = filterRestaurants(data, { query: '', cuisine: '', price: 4, onlyOpen: false })
    expect(r.map((x) => x.id)).toEqual(['cn-shanghai-c'])
  })
  it('query 命中 name/address/notes/tags/推荐菜', () => {
    expect(filterRestaurants(data, { query: '甲', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-a'])
    expect(filterRestaurants(data, { query: '南京', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-c'])
    expect(filterRestaurants(data, { query: '安格斯', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-a'])
  })
  it('description 也参与搜索', () => {
    const d = [mk({ id: 'cn-shanghai-d', description: '这是探店正文，提到招牌红烧肉' })]
    expect(filterRestaurants(d, { query: '红烧肉', cuisine: '', price: 0, onlyOpen: false }).map((x) => x.id)).toEqual(['cn-shanghai-d'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd frontend && pnpm test
```
Expected: FAIL（`filterRestaurants` 不存在）。

- [ ] **Step 3: 实现 `useFilter.ts`**

```typescript
import type { RestaurantEntry } from '@/types/restaurant'

export interface FilterState {
  query: string
  cuisine: string
  price: number
  onlyOpen: boolean
}

export function branchClosed(entry: RestaurantEntry): boolean {
  return (entry.status && entry.status !== 'open') || (entry.tags ?? []).includes('已关店')
}

export function filterRestaurants(all: RestaurantEntry[], s: FilterState): RestaurantEntry[] {
  const q = s.query.trim().toLowerCase()
  return all
    .filter((r) => !(s.onlyOpen && branchClosed(r)))
    .filter((r) => !(s.cuisine && r.cuisine !== s.cuisine))
    .filter((r) => !(s.price && r.price_level !== s.price))
    .filter((r) => {
      if (!q) return true
      const hay = [
        r.name, r.cuisine, r.address, r.notes, r.description,
        (r.tags ?? []).join(' '),
        (r.recommendations ?? []).map((x) => x.name).join(' '),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd frontend && pnpm test
```
Expected: useFilter 测试 PASS。

- [ ] **Step 5: 写 `useChains.test.ts`（先失败）**

```typescript
import { describe, it, expect } from 'vitest'
import { toDisplayItems, brandKey, branchClosed, branchLabel, averageRating } from '@/composables/useChains'
import type { RestaurantEntry } from '@/types/restaurant'

const mk = (over: Partial<RestaurantEntry> = {}): RestaurantEntry => ({
  id: 'cn-shanghai-x', name: '测试', city: '上海', country: 'cn',
  cuisine: '西餐', price_level: 2, status: 'open', ...over,
})

describe('useChains', () => {
  it('brandKey 取 id 第三段', () => {
    expect(brandKey(mk({ id: 'cn-shanghai-chilis-pudong' }))).toBe('chilis')
  })
  it('branchClosed 识别 status 与 已关店 tag', () => {
    expect(branchClosed(mk({ status: 'closed' }))).toBe(true)
    expect(branchClosed(mk({ status: 'open', tags: ['已关店'] }))).toBe(true)
    expect(branchClosed(mk({ status: 'open' }))).toBe(false)
  })
  it('branchLabel 从 address 剥掉市/区', () => {
    expect(branchLabel(mk({ address: '上海市徐汇区徐汇万科广场' }))).toBe('徐汇万科广场')
    expect(branchLabel(mk({ address: '上海市静安区陕西北路100号' }))).toBe('陕西北路100号')
  })
  it('averageRating 忽略无评分', () => {
    expect(averageRating([mk({ rating: 4 }), mk({ rating: 5 }), mk({})])).toBeCloseTo(4.5)
    expect(averageRating([mk({}), mk({})])).toBeNull()
  })
  it('toDisplayItems 合并 ≥2 家、单店独立', () => {
    const list: RestaurantEntry[] = [
      mk({ id: 'cn-shanghai-chilis-a', name: "Chili's" }),
      mk({ id: 'cn-shanghai-chilis-b', name: "Chili's" }),
      mk({ id: 'cn-shanghai-solo-x', name: '独店' }),
    ]
    const items = toDisplayItems(list, true)
    expect(items).toHaveLength(2)
    const chain = items.find((i) => i.type === 'chain')
    expect(chain && chain.type === 'chain' && chain.brand.branches).toHaveLength(2)
    expect(items.find((i) => i.type === 'single')).toBeDefined()
  })
  it('mergeChains=false 时全部为 single', () => {
    const list: RestaurantEntry[] = [
      mk({ id: 'cn-shanghai-chilis-a', name: "Chili's" }),
      mk({ id: 'cn-shanghai-chilis-b', name: "Chili's" }),
    ]
    expect(toDisplayItems(list, false).every((i) => i.type === 'single')).toBe(true)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

```bash
cd frontend && pnpm test
```
Expected: useChains 测试 FAIL（未实现）。

- [ ] **Step 7: 实现 `useChains.ts`**

```typescript
import type { RestaurantEntry, DisplayItem, ChainBrand } from '@/types/restaurant'
import { branchClosed } from './useFilter'

export function brandKey(entry: RestaurantEntry): string {
  return entry.id.split('-')[2] ?? entry.id
}

export { branchClosed }

export function branchLabel(entry: RestaurantEntry): string {
  let a = (entry.address ?? '').trim()
  if (a) {
    const stripped = a.replace(/^[^市]*市/, '').replace(/^[^区县]+[区县]/, '').trim()
    if (stripped) a = stripped
  }
  if (a) return a
  const tags = entry.tags ?? []
  return tags[tags.length - 1] ?? entry.name ?? entry.id
}

export function specialTag(entry: RestaurantEntry): string {
  const tags = entry.tags ?? []
  return tags.find((t) => ['首店', '旗舰店', '总店', '加盟店', '概念店'].includes(t)) ?? ''
}

export function averageRating(entries: RestaurantEntry[]): number | null {
  const rs = entries.map((e) => e.rating).filter((x): x is number => typeof x === 'number')
  if (rs.length === 0) return null
  return rs.reduce((a, b) => a + b, 0) / rs.length
}

export function toDisplayItems(list: RestaurantEntry[], mergeChains: boolean): DisplayItem[] {
  if (!mergeChains) {
    return list.map((entry) => ({ type: 'single', entry }))
  }
  // 计算每个 brand 的总数（基于全量？这里基于传入 list，调用方应传筛选后结果）
  const counts = new Map<string, number>()
  for (const e of list) counts.set(brandKey(e), (counts.get(brandKey(e)) ?? 0) + 1)

  const groups = new Map<string, RestaurantEntry[]>()
  const singles: DisplayItem[] = []
  for (const e of list) {
    const k = brandKey(e)
    if ((counts.get(k) ?? 0) >= 2) {
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(e)
    } else {
      singles.push({ type: 'single', entry: e })
    }
  }
  const chains: DisplayItem[] = []
  for (const [k, branches] of groups) {
    const first = branches[0]!
    const brand: ChainBrand = { key: k, name: first.name, cuisine: first.cuisine, branches }
    chains.push({ type: 'chain', brand })
  }
  return [...chains, ...singles]
}
```

> 注意：`toDisplayItems` 的合并基于"传入 list 内同 brand ≥2"。这样在筛选后仍正确——筛选掉的店不参与计数。链路页要把"是否≥2"判断放在筛选后的 list 上（与现预览页行为一致）。

- [ ] **Step 8: 跑测试确认通过**

```bash
cd frontend && pnpm test
```
Expected: 全部 PASS。

- [ ] **Step 9: typecheck**

```bash
cd frontend && pnpm typecheck
```
Expected: 0 error（`branches[0]!` 满足 noUncheckedIndexedAccess）。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/composables frontend/src/tests
git commit -m "feat(frontend): 筛选与连锁合并纯函数 + 单元测试

filterRestaurants(含正文搜索)、toDisplayItems(≥2 家合并)、
brandKey/branchLabel/averageRating 等工具函数；Vitest 覆盖。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 样式 tokens + 通用小组件

**Files:**
- Create: `frontend/src/styles/tokens.css`（暖色变量 + 深色模式，迁移自现 `web/index.html`）
- Create: `frontend/src/components/RatingStars.vue`
- Create: `frontend/src/components/PriceLevel.vue`
- Create: `frontend/src/components/StatBar.vue`
- Create: `frontend/src/components/StatusBadge.vue`
- Modify: `frontend/src/main.ts`（import tokens.css）

**Interfaces:**
- Produces: 可复用的展示原子组件，供列表/详情页使用。

- [ ] **Step 1: 创建 `frontend/src/styles/tokens.css`**

从现 `web/index.html` 的 `<style>` 中提取 `:root` 变量与 `@media (prefers-color-scheme: dark)` 块，作为独立 CSS：

```css
:root {
  --bg: #f6f1ea;
  --bg-grad: #efe7db;
  --card: #ffffff;
  --ink: #2a2018;
  --ink-soft: #6c5d4f;
  --ink-mute: #9c8d7d;
  --brand: #c8553d;
  --brand-dark: #a23b26;
  --brand-soft: #fcebe3;
  --accent: #e09f3e;
  --accent-soft: #fbe9cf;
  --line: #ece3d6;
  --line-strong: #e0d4c2;
  --shadow: 0 4px 14px rgba(120, 80, 50, 0.08), 0 1px 3px rgba(120, 80, 50, 0.05);
  --shadow-lg: 0 14px 34px rgba(120, 80, 50, 0.14), 0 2px 6px rgba(120, 80, 50, 0.06);
  --radius: 18px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17120f; --bg-grad: #1d1713; --card: #251d18;
    --ink: #f3ece2; --ink-soft: #c4b4a3; --ink-mute: #8a7a6a;
    --brand: #e0735a; --brand-dark: #c8553d; --brand-soft: #3a241c;
    --accent: #f0b65c; --accent-soft: #3c2e16;
    --line: #382d25; --line-strong: #463830;
    --shadow: 0 4px 14px rgba(0,0,0,.34);
    --shadow-lg: 0 14px 34px rgba(0,0,0,.5);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  background: radial-gradient(900px 500px at 100% -8%, var(--bg-grad), transparent), var(--bg);
  color: var(--ink); line-height: 1.6; -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1200px; margin: 0 auto; padding: 0 22px; }
```

- [ ] **Step 2: 创建 `frontend/src/components/RatingStars.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ rating?: number }>()
function stars(r: number): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += i < Math.round(r) ? '★' : '·'
  return s
}
</script>

<template>
  <span v-if="props.rating" class="rating">
    <span class="stars">{{ stars(props.rating) }}</span>
    <span class="num">{{ props.rating.toFixed(1) }}</span>
  </span>
</template>

<style scoped>
.rating { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; }
.stars { letter-spacing: 1px; }
.num { font-size: 13px; }
</style>
```

- [ ] **Step 3: 创建 `frontend/src/components/PriceLevel.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ level?: number; max?: number }>()
</script>

<template>
  <span v-if="props.level" class="price">
    {{ '¥'.repeat(Math.min(props.level, props.max ?? 5)) }}<span class="off">{{ '¥'.repeat(Math.max(0, (props.max ?? 5) - props.level)) }}</span>
  </span>
</template>

<style scoped>
.price { color: var(--accent); font-weight: 700; letter-spacing: .5px; }
.off { color: var(--line-strong); font-weight: 600; }
</style>
```

- [ ] **Step 4: 创建 `frontend/src/components/StatusBadge.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ status?: string }>()
const label: Record<string, string> = { open: '营业中', closed: '已关闭', relocated: '已搬迁', demolished: '已拆除' }
</script>

<template>
  <span v-if="props.status && props.status !== 'open'" class="badge">{{ label[props.status] ?? props.status }}</span>
</template>

<style scoped>
.badge { background: #e8e0d4; color: #8a7a6a; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 650; }
@media (prefers-color-scheme: dark) { .badge { background: #3a322c; color: #9a8a7a; } }
</style>
```

- [ ] **Step 5: 创建 `frontend/src/components/StatBar.vue`**

```vue
<script setup lang="ts">
defineProps<{ total: number; open: number; cuisines: number; chains: number; chainStores: number }>()
</script>

<template>
  <div class="stats">
    <div class="stat"><b>{{ total }}</b><span>家餐厅</span></div>
    <div class="stat"><b>{{ open }}</b><span>家营业中</span></div>
    <div class="stat"><b>{{ cuisines }}</b><span>种菜系</span></div>
    <div class="stat"><b>{{ chains }}</b><span>个连锁品牌 · {{ chainStores }} 店</span></div>
  </div>
</template>

<style scoped>
.stats { display: flex; gap: 12px; flex-wrap: wrap; }
.stat { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 12px 18px; min-width: 104px; }
.stat b { font-size: 24px; font-weight: 800; display: block; line-height: 1.1; }
.stat span { font-size: 12px; opacity: .9; }
</style>
```

- [ ] **Step 6: 在 `main.ts` 引入 tokens**

在 `frontend/src/main.ts` 顶部加：

```typescript
import './styles/tokens.css'
```

- [ ] **Step 7: typecheck + build**

```bash
cd frontend && pnpm typecheck && pnpm build
```
Expected: 0 error。

- [ ] **Step 8: 提交**

```bash
git add frontend/src/styles frontend/src/components frontend/src/main.ts
git commit -m "feat(frontend): 样式 tokens + 通用展示组件

暖色变量体系与深色模式(迁移自旧预览页)；RatingStars/PriceLevel/
StatusBadge/StatBar 原子组件。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 列表页（卡片网格 + 工具栏）

**Files:**
- Create: `frontend/src/components/SearchBar.vue`
- Create: `frontend/src/components/FilterBar.vue`
- Create: `frontend/src/components/RestaurantCard.vue`
- Create: `frontend/src/components/ChainCard.vue`
- Create: `frontend/src/components/BranchList.vue`
- Modify: `frontend/src/views/RestaurantList.vue`（替换占位）
- Modify: `frontend/src/stores/restaurants.ts`（加 `visible` getter 用纯函数）

**Interfaces:**
- Consumes: store（Task 4）、`filterRestaurants`/`toDisplayItems`（Task 5）、`RestaurantEntry`/`DisplayItem`（Task 3）、通用组件（Task 6）

- [ ] **Step 1: store 加 visible getter**

在 `frontend/src/stores/restaurants.ts`，`import { ref } from 'vue'` 改为：

```typescript
import { ref, computed } from 'vue'
```

顶部加导入：

```typescript
import { filterRestaurants } from '@/composables/useFilter'
import { toDisplayItems, brandKey, branchClosed } from '@/composables/useChains'
import type { DisplayItem } from '@/types/restaurant'
```

在 `load` 函数定义之前加：

```typescript
  const filtered = computed(() =>
    filterRestaurants(all.value, {
      query: query.value,
      cuisine: cuisine.value,
      price: price.value,
      onlyOpen: onlyOpen.value,
    })
  )
  const visible = computed<DisplayItem[]>(() => toDisplayItems(filtered.value, mergeChains.value))

  const chainKeys = computed(() => {
    const c = new Map<string, number>()
    for (const e of all.value) c.set(brandKey(e), (c.get(brandKey(e)) ?? 0) + 1)
    return new Set([...c.entries()].filter(([, n]) => n >= 2).map(([k]) => k))
  })
  const stats = computed(() => ({
    total: all.value.length,
    open: all.value.filter((e) => !branchClosed(e)).length,
    cuisines: new Set(all.value.map((e) => e.cuisine)).size,
    chains: chainKeys.value.size,
    chainStores: all.value.filter((e) => chainKeys.value.has(brandKey(e))).length,
  }))
  const cuisineOptions = computed(() =>
    [...new Set(all.value.map((e) => e.cuisine))].sort((a, b) => a.localeCompare(b, 'zh'))
  )
```

`return` 里追加：`filtered, visible, stats, cuisineOptions`。

- [ ] **Step 2: 创建 `SearchBar.vue`**

```vue
<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>

<template>
  <label class="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
    <input v-model="model" type="search" placeholder="搜索店名、菜系、地址、招牌菜、标签…" autocomplete="off" />
  </label>
</template>

<style scoped>
.search { flex: 1 1 280px; min-width: 200px; display: flex; align-items: center; gap: 9px; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; }
.search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.search svg { width: 17px; height: 17px; fill: var(--ink-mute); }
.search input { border: none; outline: none; background: transparent; width: 100%; font-size: 14.5px; color: var(--ink); }
</style>
```

- [ ] **Step 3: 创建 `FilterBar.vue`**

```vue
<script setup lang="ts">
import SearchBar from './SearchBar.vue'

defineProps<{ cuisineOptions: string[]; resultCount: string }>()
const query = defineModel<string>('query', { default: '' })
const cuisine = defineModel<string>('cuisine', { default: '' })
const price = defineModel<number>('price', { default: 0 })
const onlyOpen = defineModel<boolean>('onlyOpen', { default: true })
const mergeChains = defineModel<boolean>('mergeChains', { default: true })
</script>

<template>
  <div class="bar">
    <SearchBar v-model="query" />
    <select v-model="cuisine"><option value="">全部菜系</option><option v-for="c in cuisineOptions" :key="c" :value="c">{{ c }}</option></select>
    <select v-model.number="price">
      <option :value="0">全部价位</option>
      <option :value="1">¥ 人均低</option><option :value="2">¥¥</option><option :value="3">¥¥¥</option><option :value="4">¥¥¥¥</option><option :value="5">¥¥¥¥¥ 人均高</option>
    </select>
    <label class="toggle"><input type="checkbox" v-model="mergeChains" /><span>合并连锁店</span></label>
    <label class="toggle"><input type="checkbox" v-model="onlyOpen" /><span>仅营业中</span></label>
    <span class="count">{{ resultCount }}</span>
  </div>
</template>

<style scoped>
.bar { background: var(--card); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow-lg); padding: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
select { appearance: none; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; font-size: 13.5px; cursor: pointer; }
.toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); cursor: pointer; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
.toggle input { width: 16px; height: 16px; accent-color: var(--brand); margin: 0; }
.count { font-size: 12.5px; color: var(--ink-mute); margin-left: auto; }
</style>
```

- [ ] **Step 4: 创建 `RestaurantCard.vue`**

```vue
<script setup lang="ts">
import type { RestaurantEntry } from '@/types/restaurant'
import RatingStars from './RatingStars.vue'
import PriceLevel from './PriceLevel.vue'
import StatusBadge from './StatusBadge.vue'
import { REPO } from '@/lib/repo'

const props = defineProps<{ entry: RestaurantEntry; hue: number }>()
const bar = `hsl(${props.hue} 68% 50%)`
</script>

<template>
  <article class="card" :style="{ '--bar': bar }">
    <div class="head">
      <h3 class="name">{{ entry.name }}</h3>
      <RatingStars :rating="entry.rating" />
    </div>
    <div class="meta">
      <span class="cuisine">{{ entry.cuisine }}</span>
      <PriceLevel :level="entry.price_level" />
      <StatusBadge :status="entry.status" />
    </div>
    <p v-if="entry.address" class="addr">📍 {{ entry.address }}</p>
    <div v-if="entry.recommendations?.length" class="recs">
      <span v-for="(r, i) in entry.recommendations.slice(0, 4)" :key="i" class="rec">★ {{ r.name }}</span>
    </div>
    <div v-if="entry.tags?.length" class="tags">
      <span v-for="t in entry.tags.filter(t => t !== '连锁').slice(0, 8)" :key="t" class="tag">{{ t }}</span>
    </div>
    <div class="foot">
      <span v-if="entry.notes" class="note">{{ entry.notes }}</span>
      <a :href="`${REPO}/blob/main/${entry.path}`" target="_blank" rel="noopener" class="src">查看源文件 →</a>
    </div>
  </article>
</template>

<style scoped>
.card { background: var(--card); border: 1px solid var(--line); border-top: 3px solid var(--bar); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 12px; transition: transform .16s, box-shadow .16s; }
.card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.head { display: flex; justify-content: space-between; gap: 10px; }
.name { font-size: 17px; font-weight: 750; margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.addr { font-size: 12.5px; color: var(--ink-soft); margin: 0; }
.recs { display: flex; flex-wrap: wrap; gap: 6px; }
.rec { font-size: 11.5px; color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); padding: 4px 10px; border-radius: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
.foot { margin-top: auto; padding-top: 11px; border-top: 1px dashed var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.note { font-size: 11px; color: var(--ink-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.src { font-size: 12px; color: var(--brand); text-decoration: none; font-weight: 600; }
.src:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 5: 创建 `frontend/src/lib/repo.ts`**

```typescript
export const REPO = 'https://github.com/fgh23333/AI4Food'
```

- [ ] **Step 6: 创建 `BranchList.vue`**

```vue
<script setup lang="ts">
import type { RestaurantEntry } from '@/types/restaurant'
import { REPO } from '@/lib/repo'
import { branchClosed, branchLabel, specialTag } from '@/composables/useChains'
import { statusLabel } from '@/lib/status'

defineProps<{ branches: RestaurantEntry[]; open: boolean }>()
</script>

<template>
  <div class="branch-list">
    <a v-for="b in branches" :key="b.id" :class="{ closed: branchClosed(b) }" class="row" :href="`${REPO}/blob/main/${b.path}`" target="_blank" rel="noopener" :title="b.address">
      <span class="label">{{ branchLabel(b) }}</span>
      <span v-if="branchClosed(b)" class="badge closed">{{ statusLabel(b.status) }}</span>
      <span v-else-if="specialTag(b)" class="badge">{{ specialTag(b) }}</span>
      <span v-if="b.rating" class="rate">★ {{ b.rating.toFixed(1) }}</span>
      <span class="go">›</span>
    </a>
  </div>
</template>

<style scoped>
.branch-list { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 1fr auto auto 14px; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); padding: 9px 8px; border-radius: 9px; }
.row + .row { border-top: 1px dashed var(--line); }
.row:hover { background: var(--bg); }
.row.closed { opacity: .58; }
.label { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 10.5px; font-weight: 700; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 999px; }
.badge.closed { color: #8a7a6a; background: #ece4d8; }
.rate { font-size: 12.5px; font-weight: 700; color: var(--accent); }
.go { color: var(--ink-mute); }
</style>
```

- [ ] **Step 7: 创建 `frontend/src/lib/status.ts`**

```typescript
export function statusLabel(s?: string): string {
  const m: Record<string, string> = { open: '营业中', closed: '已关闭', relocated: '已搬迁', demolished: '已拆除' }
  return (s && m[s]) || s || ''
}
```

- [ ] **Step 8: 创建 `ChainCard.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChainBrand } from '@/types/restaurant'
import { branchClosed, averageRating } from '@/composables/useChains'
import RatingStars from './RatingStars.vue'
import BranchList from './BranchList.vue'

const props = defineProps<{ brand: ChainBrand; hue: number; defaultOpen: boolean }>()
const bar = `hsl(${props.hue} 68% 50%)`
const open = ref(props.defaultOpen)
const openCount = computed(() => props.brand.branches.filter((b) => !branchClosed(b)).length)
const avg = computed(() => averageRating(props.brand.branches))
const levels = computed(() => props.brand.branches.map((b) => b.price_level).filter((x): x is number => typeof x === 'number'))
const priceText = computed(() => {
  if (levels.value.length === 0) return ''
  const lo = Math.min(...levels.value), hi = Math.max(...levels.value)
  return lo === hi ? `¥×${lo}` : `¥×${lo}–${hi}`
})
const mergedTags = computed(() => {
  const seen = new Set<string>(); const out: string[] = []
  for (const b of props.brand.branches) for (const t of b.tags ?? []) {
    if (t === '连锁' || t === '已关店' || seen.has(t)) continue
    seen.add(t); out.push(t)
  }
  return out.slice(0, 8)
})
const mergedRecs = computed(() => {
  const seen = new Set<string>(); const out: { name: string; note?: string }[] = []
  for (const b of props.brand.branches) for (const r of b.recommendations ?? []) {
    if (r.name && !seen.has(r.name)) { seen.add(r.name); out.push(r) }
  }
  return out.slice(0, 4)
})
</script>

<template>
  <article class="card chain" :style="{ '--bar': bar }">
    <div class="head">
      <div class="brand-left">
        <span class="monogram" :style="{ background: `${bar}1f`, color: bar }">{{ brand.name.trim()[0] }}</span>
        <div>
          <h3 class="name">{{ brand.name }}</h3>
          <div class="sub">连锁品牌 · {{ brand.branches.length }} 家 · {{ openCount }} 营业<span v-if="avg"> · 均分 {{ avg.toFixed(1) }}</span></div>
        </div>
      </div>
      <RatingStars v-if="avg" :rating="Math.round(avg * 2) / 2" />
    </div>
    <div class="meta"><span class="cuisine">{{ brand.cuisine }}</span><span v-if="priceText" class="price">{{ priceText }}</span></div>
    <div v-if="mergedRecs.length" class="recs"><span v-for="(r, i) in mergedRecs" :key="i" class="rec">★ {{ r.name }}</span></div>
    <div v-if="mergedTags.length" class="tags"><span v-for="t in mergedTags" :key="t" class="tag">{{ t }}</span></div>
    <details :open="open">
      <summary @click.prevent="open = !open"><span>查看 {{ brand.branches.length }} 家分店</span><span class="chev">▾</span></summary>
      <BranchList :branches="brand.branches" :open="open" />
    </details>
  </article>
</template>

<style scoped>
.card { background: var(--card); border: 1px solid var(--line); border-top: 4px solid var(--bar); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; justify-content: space-between; gap: 10px; }
.brand-left { display: flex; gap: 13px; align-items: center; }
.monogram { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; font-size: 21px; font-weight: 800; }
.name { font-size: 17px; font-weight: 750; margin: 0; }
.sub { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; }
.meta { display: flex; gap: 8px; align-items: center; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.price { color: var(--accent); font-weight: 700; }
.recs { display: flex; flex-wrap: wrap; gap: 6px; }
.rec { font-size: 11.5px; color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); padding: 4px 10px; border-radius: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
summary { list-style: none; cursor: pointer; padding: 9px 4px; font-size: 13px; font-weight: 600; color: var(--brand); display: flex; justify-content: space-between; }
summary::-webkit-details-marker { display: none; }
.chev { transition: transform .18s; }
details[open] .chev { transform: rotate(180deg); }
</style>
```

- [ ] **Step 9: 改 `RestaurantList.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRestaurantsStore } from '@/stores/restaurants'
import FilterBar from '@/components/FilterBar.vue'
import RestaurantCard from '@/components/RestaurantCard.vue'
import ChainCard from '@/components/ChainCard.vue'
import StatBar from '@/components/StatBar.vue'

const store = useRestaurantsStore()
onMounted(() => { if (!store.loaded) store.load() })
function hue(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h
}
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="brand"><span class="logo">🍽️</span><div><h1>AI4Food</h1><p class="sub">社区共建的上海餐厅数据图鉴</p></div></div>
      <StatBar v-bind="store.stats" />
    </div>
  </header>
  <main class="wrap toolbar"><FilterBar v-model:query="store.query" v-model:cuisine="store.cuisine" v-model:price="store.price" v-model:onlyOpen="store.onlyOpen" v-model:mergeChains="store.mergeChains" :cuisine-options="store.cuisineOptions" :result-count="`显示 ${store.filtered.length} / ${store.all.length} 家`" /></main>
  <main class="wrap">
    <div v-if="store.error" class="state">⚠️ 数据加载失败：{{ store.error }}</div>
    <div v-else-if="!store.loaded" class="state">加载中…</div>
    <div v-else-if="!store.visible.length" class="state">没有匹配的餐厅，试试调整筛选。</div>
    <div v-else class="grid">
      <template v-for="(item, i) in store.visible" :key="i">
        <RestaurantCard v-if="item.type === 'single'" :entry="item.entry" :hue="hue(item.entry.cuisine)" />
        <ChainCard v-else :brand="item.brand" :hue="hue(item.brand.cuisine)" :default-open="!!store.query || !!store.cuisine || !!store.price" />
      </template>
    </div>
  </main>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #d35a40, #9c3522); color: #fff; padding: 46px 0 64px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 46px; height: 46px; border-radius: 13px; background: rgba(255,255,255,.16); display: grid; place-items: center; font-size: 24px; }
h1 { margin: 0; font-size: 30px; font-weight: 800; }
.sub { margin: 2px 0 0; font-size: 13.5px; opacity: .9; }
.hero :deep(.stats) { margin-top: 26px; }
.toolbar { margin-top: -34px; position: relative; z-index: 5; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(336px, 1fr)); padding-bottom: 64px; }
.state { text-align: center; padding: 80px 20px; color: var(--ink-mute); }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 10: typecheck + test + build**

```bash
cd frontend && pnpm typecheck && pnpm test && pnpm build
```
Expected: 0 error；测试全绿；build 产出。

- [ ] **Step 11: dev 目视验证**

```bash
cd frontend && pnpm dev
```
浏览器确认：卡片网格、连锁合并卡可展开分店、筛选/搜索/合并开关生效、统计正确。Ctrl+C。

- [ ] **Step 12: 提交**

```bash
git add frontend/src
git commit -m "feat(frontend): 列表页 — 卡片网格/工具栏/连锁合并卡

SearchBar/FilterBar/RestaurantCard/ChainCard/BranchList；store 加
filtered/visible/stats getter；有筛选时连锁自动展开。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 详情页（含 Markdown 正文渲染）

**Files:**
- Create: `frontend/src/lib/markdown.ts`
- Modify: `frontend/src/views/RestaurantDetail.vue`（替换占位）

**Interfaces:**
- Consumes: store（按 id 查 entry）、`description`（Task 1）、marked + DOMPurify、通用组件（Task 6）。

- [ ] **Step 1: 创建 `frontend/src/lib/markdown.ts`**

```typescript
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(src: string | undefined): string {
  if (!src) return ''
  return DOMPurify.sanitize(marked.parse(src) as string)
}
```

> 若 typecheck 报 `@types/dompurify` 与 dompurify 3.x 自带类型冲突，删除 devDependency `@types/dompurify` 并 `pnpm install`。

- [ ] **Step 2: 改 `RestaurantDetail.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRestaurantsStore } from '@/stores/restaurants'
import RatingStars from '@/components/RatingStars.vue'
import PriceLevel from '@/components/PriceLevel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { renderMarkdown } from '@/lib/markdown'
import { statusLabel } from '@/lib/status'
import { REPO } from '@/lib/repo'

const props = defineProps<{ id: string }>()
const store = useRestaurantsStore()
if (!store.loaded) store.load()

const entry = computed(() => store.all.find((e) => e.id === props.id))
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const dayLabel: Record<string, string> = { mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' }
</script>

<template>
  <main class="wrap detail">
    <router-link to="/" class="back">← 返回列表</router-link>
    <div v-if="!entry" class="state">
      <p>未找到该餐厅（id: {{ id }}）。</p>
      <router-link to="/">回列表</router-link>
    </div>
    <article v-else class="card">
      <h1>{{ entry.name }}</h1>
      <div class="meta">
        <RatingStars :rating="entry.rating" />
        <span class="cuisine">{{ entry.cuisine }}</span>
        <PriceLevel :level="entry.price_level" />
        <StatusBadge :status="entry.status" />
      </div>
      <p v-if="entry.address" class="row">📍 <a :href="`https://www.amap.com/search?query=${encodeURIComponent(entry.address)}`" target="_blank" rel="noopener">{{ entry.address }}</a></p>
      <p v-if="entry.phone" class="row">☎ <a :href="`tel:${entry.phone}`">{{ entry.phone }}</a></p>
      <section v-if="entry.opening_hours" class="hours">
        <h3>营业时间</h3>
        <ul>
          <li v-for="d in days" :key="d">{{ dayLabel[d] }}：{{ entry.opening_hours[d] ?? '—' }}</li>
        </ul>
      </section>
      <section v-if="entry.recommendations?.length" class="recs">
        <h3>招牌推荐</h3>
        <ul><li v-for="(r, i) in entry.recommendations" :key="i"><b>{{ r.name }}</b><span v-if="r.note"> — {{ r.note }}</span></li></ul>
      </section>
      <section v-if="entry.tags?.length" class="tags"><span v-for="t in entry.tags.filter(t => t !== '连锁')" :key="t" class="tag">{{ t }}</span></section>
      <section v-if="entry.description" class="desc">
        <h3>探店正文</h3>
        <div class="md" v-html="renderMarkdown(entry.description)"></div>
      </section>
      <p v-if="entry.notes" class="notes">{{ entry.notes }}</p>
      <p class="updated">更新于 {{ entry.updated_at ?? '—' }}</p>
      <a :href="`${REPO}/blob/main/${entry.path}`" target="_blank" rel="noopener" class="src">查看源文件 →</a>
    </article>
  </main>
</template>

<style scoped>
.detail { padding: 24px 22px 64px; }
.back { color: var(--brand); text-decoration: none; font-size: 13px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); margin-top: 14px; }
h1 { margin: 0 0 12px; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.row { margin: 6px 0; font-size: 14px; }
.row a { color: var(--brand); }
section { margin-top: 20px; }
h3 { font-size: 15px; margin: 0 0 8px; color: var(--ink-soft); }
ul { margin: 0; padding-left: 20px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
.md { font-size: 14.5px; line-height: 1.8; }
.notes { margin-top: 20px; padding: 12px 14px; background: var(--bg); border-radius: 10px; font-size: 13px; color: var(--ink-soft); }
.updated { font-size: 11px; color: var(--ink-mute); }
.src { display: inline-block; margin-top: 16px; color: var(--brand); text-decoration: none; font-weight: 600; }
.state { text-align: center; padding: 60px 20px; color: var(--ink-mute); }
</style>
```

- [ ] **Step 3: typecheck + test + build**

```bash
cd frontend && pnpm typecheck && pnpm test && pnpm build
```
Expected: 0 error。处理 dompurify 类型（按 Step 1 注）。

- [ ] **Step 4: dev 目视验证**

```bash
cd frontend && pnpm dev
```
浏览器访问 `/#/restaurants/cn-shanghai-alilando-jingan`，确认正文（探店正文）渲染、营业时间、推荐菜、地图外链、源文件链接正常。Ctrl+C。

- [ ] **Step 5: 提交**

```bash
git add frontend/src
git commit -m "feat(frontend): 详情页 — 完整信息 + Markdown 正文渲染

marked + DOMPurify 渲染 description 正文；营业时间/推荐菜/地图外链/
源文件链接；id 不存在走 404 友好态。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 部署 workflow 改造（部署 frontend 产物 + 升 CI action 版本）

**Files:**
- Modify: `.github/workflows/deploy-web.yml`（改为构建 frontend 并部署）
- Modify: `.github/workflows/build-index.yml`（升 action 版本）
- Modify: `.github/workflows/validate.yml`（升 action 版本）

- [ ] **Step 1: 重写 `deploy-web.yml`**

```yaml
name: Deploy Preview Page

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - 'dist/index.json'
      - '.github/workflows/deploy-web.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Install frontend deps
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Type-sync check
        working-directory: frontend
        run: pnpm check-schema

      - name: Build
        working-directory: frontend
        run: pnpm build

      - name: Stage data
        run: |
          mkdir -p frontend/dist/dist
          cp dist/index.json frontend/dist/dist/index.json

      - uses: actions/configure-pages@v6

      - uses: actions/upload-pages-artifact@v5
        with:
          path: frontend/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: 升级 `build-index.yml` 与 `validate.yml` 的 action 版本**

把两个文件里的 `actions/checkout@v4` → `@v5`、`actions/setup-node@v4` → `@v5`（`pnpm/action-setup@v4` 保持）。逐文件用 Edit 工具替换。

- [ ] **Step 3: 本地 build 确认产物可部署**

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm check-schema && pnpm build
mkdir -p dist/dist && cp ../dist/index.json dist/dist/index.json && ls dist
```
Expected: `dist/` 下有 `index.html`、`assets/`、`dist/index.json`。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/
git commit -m "chore(ci): 部署 frontend 构建产物到 Pages，升级 actions 版本

deploy-web.yml 改为 pnpm build frontend 并附带 dist/index.json，
build 前跑 check-schema 类型漂移校验；
build-index/validate 的 actions 升到 Node 24 runtime（v5/v6）。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

> 部署验证在合并到 main 后由 Actions 实跑；本任务本地只保证 build 成功。

---

## Task 10: 删除旧预览页 + 文档收尾

**Files:**
- Delete: `web/index.html`（删整个 `web/` 目录）
- Modify: `docs/ROADMAP.md`（三期标「已实现」，调整说明）
- Modify: `README.md`（若有指向 web/index.html 的内容，改为指向 Pages 站点）

- [ ] **Step 1: 删除旧预览页**

```bash
git rm -r web
```

- [ ] **Step 2: 更新 `docs/ROADMAP.md`**

把「三期：前端展示网站」标为 ✅ 已实现，注明 Vue SPA + GitHub Pages，正文读取 dist/index.json。把「二期：后端 API」保留为下一期（与 AI 合并）。

- [ ] **Step 3: 更新 `README.md`**

检查 README 是否提到 `web/index.html` 或单页预览；若有，改为指向线上站点 `https://fgh23533.github.io/AI4Food/`。新增一段「前端」说明：`frontend/` 目录、`pnpm dev`/`build`。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: 移除旧单页预览 web/，更新路线图与 README

Vue SPA 上线后不再需要 web/index.html；ROADMAP 三期标已实现，
README 指向线上 Pages 站点并补充 frontend/ 说明。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 自检（写完后执行）

**1. Spec 覆盖：** 逐条对照 spec §0~§9
- Vue SPA + 直读 JSON → Task 2/4 ✓
- 不做地图 → 无地图任务 ✓
- 正文进索引 description → Task 1 ✓
- 类型漂移校验 → Task 3 ✓
- 删旧 web → Task 10 ✓
- 部署 GitHub Pages + base path + hash 路由 → Task 2/9 ✓
- 连锁合并 → Task 5/7 ✓

**2. 占位符扫描：** 无 TBD/TODO/「类似上文」。ChainCard 的笔误已标注修正方式（Task 7 Step 8）。

**3. 类型一致性：** `description?: string` 在 IndexEntry（Task 1）、RestaurantEntry（Task 3）、useFilter 搜索（Task 5）三处一致。`DisplayItem`/`ChainBrand` 在 types（Task 3）、useChains（Task 5）、store/组件（Task 7）一致。

**4. CLAUDE.md 场景 B 合规：** Task 1 是唯一碰 `tools/` 的任务，全程 TDD（失败测试→实现→通过→typecheck+test+validate 全绿）。

## Execution Handoff

计划已存到 `docs/superpowers/plans/2026-07-08-frontend-vue.md`。两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 Task 派一个新 subagent 实现，任务间 review。
2. **Inline Execution** — 本会话内按 executing-plans 批量执行、设检查点。

由用户选择。
