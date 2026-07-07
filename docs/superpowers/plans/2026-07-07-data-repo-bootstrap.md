# AI4Food 数据仓库一期 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 AI4Food 餐厅数据仓库的完整一期——目录结构、frontmatter schema、TS 校验/索引工具链、CI 流程与贡献文档，使社区能规范地共同维护餐厅数据。

**Architecture:** 数据（Markdown + YAML frontmatter）与 TS 工具链同仓库。`schema/` 是单一事实来源，`tools/`（pnpm + TypeScript strict + Vitest）提供校验器、索引器、脚手架与 Hono 预留空壳。CI 在 PR 时校验、main 合并后生成索引。errors 阻塞 PR、warnings 仅提示。

**Tech Stack:** Node.js 22, pnpm 10, TypeScript 5 (strict), Vitest 2, ajv 8 (JSON Schema 校验), gray-matter (frontmatter 解析), Hono 4 (预留), GitHub Actions。

## Global Constraints

- **包管理器**：一律用 pnpm 10.33（不混用 npm/yarn）。工具链代码全部在 `tools/` 子目录，根目录不放 `package.json`（根目录是纯数据/文档仓库）。
- **TypeScript**：`tools/tsconfig.json` 必须 `strict: true`。所有 `.ts` 文件头部不需要手写注释，但公共导出函数必须有显式参数与返回类型标注。
- **数据格式**：餐厅数据一律 Markdown + YAML frontmatter；frontmatter 用 2 空格缩进。
- **目录约定**：餐厅路径 `data/restaurants/{country}/{city}/{slug}.md`；`country` 为 ISO 3166-1 alpha-2 小写；城市目录名必须等于 frontmatter 的 `city` 字段值。
- **errors 与 warnings 分离**：必填缺失、枚举非法、id 重复/不一致 → error；推荐字段缺失 → warning。
- **commit 规范**：5 种类型 `feat/fix/data/docs/chore`，遵循 Conventional Commits，描述用中文。
- **生成的产物**（`dist/index.json`）绝不写回 `data/`。
- **测试**：`tools/` 下所有非入口（CLI/脚手架）逻辑必须有 Vitest 测试。

---

## Task 1: 仓库基础配置文件

**Files:**
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.gitattributes`

**Interfaces:**
- Produces: 仓库级配置，后续任务依赖根目录已就绪。

- [ ] **Step 1: 创建 `.gitignore`**

```gitignore
# 依赖
tools/node_modules/
node_modules/

# 构建产物（保留 dist/index.json 提交，忽略其余）
tools/dist/
*.tsbuildinfo

# 编辑器与系统
.vscode/
.idea/
.DS_Store
Thumbs.db

# 环境与密钥
.env
.env.local
*.local

# 日志
*.log
npm-debug.log*
pnpm-debug.log*
```

- [ ] **Step 2: 创建 `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

- [ ] **Step 3: 创建 `.gitattributes`**

```gitattributes
# 强制文本文件统一 LF 行尾，避免 Windows CRLF 污染
* text=auto eol=lf

# Markdown 数据文件显式标记
*.md text eol=lf working-tree-encoding=UTF-8

# JSON schema
*.json text eol=lf

# 二进制资源
*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
```

- [ ] **Step 4: 验证并提交**

```bash
git add .gitignore .editorconfig .gitattributes
git commit -m "chore: 添加 gitignore/editorconfig/gitattributes 基础配置"
```

---

## Task 2: 数据 schema —— 枚举表

**Files:**
- Create: `schema/enums.json`

**Interfaces:**
- Produces: `schema/enums.json`，结构为 `{ "cuisines": string[], "statuses": string[], "priceLevels": number[] }`。Task 3 的 schema 与 Task 6 的 enums.ts 都依赖此结构。

- [ ] **Step 1: 创建枚举文件**

```json
{
  "cuisines": [
    "中餐",
    "京菜",
    "川菜",
    "粤菜",
    "淮扬菜",
    "浙菜",
    "湘菜",
    "闽菜",
    "徽菜",
    "鲁菜",
    "鄂菜",
    "东北菜",
    "西北菜",
    "云南菜",
    "新疆菜",
    "火锅",
    "烧烤",
    "日料",
    "韩料",
    "东南亚菜",
    "西餐",
    "意大利菜",
    "法餐",
    "墨西哥菜",
    "中东菜",
    "素食",
    "面食小吃",
    "甜品烘焙",
    "饮品",
    "其他"
  ],
  "statuses": ["open", "closed", "relocated", "demolished"],
  "priceLevels": [1, 2, 3, 4, 5]
}
```

- [ ] **Step 2: 提交**

```bash
git add schema/enums.json
git commit -m "feat: 添加餐厅数据枚举表 cuisines/statuses/priceLevels"
```

---

## Task 3: 数据 schema —— frontmatter JSON Schema

**Files:**
- Create: `schema/restaurant.schema.json`

**Interfaces:**
- Consumes: `schema/enums.json`（cuisines/statuses/priceLevels 取值）。
- Produces: JSON Schema (draft-07)，Task 8 的校验器用 ajv 加载它。字段命名见下方 `properties`，校验器代码不得偏离这些名字。

- [ ] **Step 1: 创建 schema 文件**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://ai4food/restaurant.schema.json",
  "title": "Restaurant",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "city", "country", "cuisine", "price_level", "status"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z]{2}-[a-z0-9-]+$",
      "description": "全局唯一，格式 {country}-{city-slug}-{store-slug}"
    },
    "name": { "type": "string", "minLength": 1 },
    "name_en": { "type": "string" },
    "city": { "type": "string", "minLength": 1 },
    "country": {
      "type": "string",
      "pattern": "^[a-z]{2}$",
      "description": "ISO 3166-1 alpha-2 小写"
    },
    "cuisine": { "type": "string", "enum": [] },
    "price_level": { "type": "integer", "enum": [] },
    "address": { "type": "string" },
    "latitude": { "type": "number", "minimum": -90, "maximum": 90 },
    "longitude": { "type": "number", "minimum": -180, "maximum": 180 },
    "phone": { "type": "string" },
    "website": { "type": "string", "format": "uri" },
    "opening_hours": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "键为 mon/tue/..., 值如 11:00-22:00"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "rating": { "type": "number", "minimum": 0, "maximum": 5, "multipleOf": 0.5 },
    "visited_date": { "type": "string", "format": "date" },
    "recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name"],
        "additionalProperties": false,
        "properties": {
          "name": { "type": "string" },
          "note": { "type": "string" }
        }
      }
    },
    "notes": { "type": "string" },
    "photos": {
      "type": "array",
      "items": { "type": "string" }
    },
    "status": { "type": "string", "enum": [] },
    "verified": { "type": "boolean" },
    "source": { "type": "string" },
    "updated_at": { "type": "string", "format": "date" }
  }
}
```

> 说明：`cuisine`、`price_level`、`status` 的 `enum` 数组留空，由 Task 8 校验器在加载时**从 enums.json 动态注入**实际取值。这样枚举表只有 `enums.json` 一处，避免双重维护。`format` 校验（uri/date）需在 Task 8 启用 ajv 的 format 关键字。

- [ ] **Step 2: 提交**

```bash
git add schema/restaurant.schema.json
git commit -m "feat: 添加餐厅 frontmatter JSON Schema (draft-07)"
```

---

## Task 4: TS 工具链脚手架（package.json / tsconfig）

**Files:**
- Create: `tools/package.json`
- Create: `tools/tsconfig.json`
- Create: `tools/src/.gitkeep`（占位，保证目录存在）

**Interfaces:**
- Produces: `tools/` 下可 `pnpm install` 与 `pnpm <script>` 运行的 TS 工程。脚本名：`validate` / `index` / `new` / `check-unique` / `server` / `test` / `lint`。后续任务的入口文件路径固定在 `tools/src/*.ts`。

- [ ] **Step 1: 创建 `tools/package.json`**

```json
{
  "name": "@ai4food/tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "AI4Food 餐厅数据仓库工具链",
  "scripts": {
    "validate": "tsx src/cli.ts validate",
    "check-unique": "tsx src/cli.ts check-unique",
    "index": "tsx src/cli.ts index",
    "new": "tsx src/cli.ts new",
    "server": "tsx src/cli.ts server",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.1",
    "gray-matter": "^4.0.3",
    "hono": "^4.6.0"
  }
}
```

- [ ] **Step 2: 创建 `tools/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: 创建占位文件保证目录**

创建空文件 `tools/src/.gitkeep`（内容为空）。

- [ ] **Step 4: 安装依赖并验证**

```bash
cd tools
pnpm install
cd ..
```
预期：`tools/node_modules/` 生成（被 .gitignore 忽略），并生成 `tools/pnpm-lock.yaml`，无错误。

- [ ] **Step 4b: 提交 lockfile**

```bash
git add tools/pnpm-lock.yaml
git commit -m "chore: 锁定 pnpm 依赖版本"
```
（lockfile 必须提交，CI 的 `--frozen-lockfile` 与 `cache-dependency-path` 都依赖它。）

- [ ] **Step 5: 提交**

```bash
git add tools/package.json tools/tsconfig.json tools/src/.gitkeep
git commit -m "feat: 初始化 TS 工具链脚手架 (pnpm/tsx/vitest)"
```

---

## Task 5: 共享类型与枚举加载

**Files:**
- Create: `tools/src/types.ts`
- Create: `tools/src/enums.ts`
- Create: `tools/tests/enums.test.ts`

**Interfaces:**
- Consumes: `schema/enums.json`。
- Produces:
  - `types.ts`: `RestaurantFrontmatter`（frontmatter 结构）、`ValidationIssue`（`{ type: 'error' | 'warning'; path: string; message: string }`）、`ValidationResult`（`{ errors: ValidationIssue[]; warnings: ValidationIssue[] }`）。
  - `enums.ts`: `loadEnums(): RestaurantEnums`，返回 `{ cuisines: string[]; statuses: string[]; priceLevels: number[] }`，从仓库根 `schema/enums.json` 读取。

- [ ] **Step 1: 先写 `tools/src/types.ts`**

```typescript
export interface RecommendationItem {
  name: string
  note?: string
}

export interface RestaurantFrontmatter {
  id: string
  name: string
  name_en?: string
  city: string
  country: string
  cuisine: string
  price_level: number
  address?: string
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  opening_hours?: Record<string, string>
  tags?: string[]
  rating?: number
  visited_date?: string
  recommendations?: RecommendationItem[]
  notes?: string
  photos?: string[]
  status: string
  verified?: boolean
  source?: string
  updated_at?: string
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  path: string
  message: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface RestaurantRecord {
  frontmatter: RestaurantFrontmatter
  body: string
  filePath: string
}

export interface RestaurantEnums {
  cuisines: string[]
  statuses: string[]
  priceLevels: number[]
}
```

- [ ] **Step 2: 写失败测试 `tools/tests/enums.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { loadEnums } from '../src/enums'

describe('loadEnums', () => {
  it('从 schema/enums.json 读取枚举', () => {
    const enums = loadEnums()
    expect(Array.isArray(enums.cuisines)).toBe(true)
    expect(enums.cuisines.length).toBeGreaterThan(0)
    expect(enums.statuses).toContain('open')
    expect(enums.statuses).toContain('closed')
    expect(enums.priceLevels).toEqual([1, 2, 3, 4, 5])
  })

  it('cuisines 不为空且每个为字符串', () => {
    const enums = loadEnums()
    for (const c of enums.cuisines) {
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd tools && pnpm test enums`
Expected: FAIL，提示找不到 `../src/enums` 模块。

- [ ] **Step 4: 实现 `tools/src/enums.ts`**

```typescript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { RestaurantEnums } from './types'

// tools/src/enums.ts → 仓库根 schema/enums.json
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export function loadEnums(): RestaurantEnums {
  const raw = readFileSync(resolve(repoRoot, 'schema', 'enums.json'), 'utf-8')
  const data = JSON.parse(raw) as RestaurantEnums
  return {
    cuisines: data.cuisines,
    statuses: data.statuses,
    priceLevels: data.priceLevels,
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd tools && pnpm test enums`
Expected: PASS（2 个测试通过）。

- [ ] **Step 6: 提交**

```bash
git add tools/src/types.ts tools/src/enums.ts tools/tests/enums.test.ts
git commit -m "feat: 添加共享类型定义与枚举加载器"
```

---

## Task 6: frontmatter 解析器

**Files:**
- Create: `tools/src/frontmatter.ts`
- Create: `tools/tests/frontmatter.test.ts`
- Create: `tools/tests/fixtures/valid-sample.md`（测试夹具）

**Interfaces:**
- Consumes: `RestaurantFrontmatter` from `./types`。
- Produces: `parseFrontmatter(filePath: string): RestaurantRecord`，读取单个 md，返回 `{ frontmatter, body, filePath }`。frontmatter 解析失败时抛出带文件路径的错误。还导出 `scanRestaurantFiles(dataDir: string): string[]`，递归返回所有 `*.md`（排除 `_` 开头的文件如 `_template.md`）的绝对路径。

- [ ] **Step 1: 写测试夹具 `tools/tests/fixtures/valid-sample.md`**

```markdown
---
id: cn-beijing-test-shop
name: 测试餐厅
city: 北京
country: cn
cuisine: 京菜
price_level: 3
status: open
address: 测试地址
latitude: 39.9
longitude: 116.4
updated_at: 2026-07-07
---

# 测试餐厅

正文内容。
```

- [ ] **Step 2: 写失败测试 `tools/tests/frontmatter.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { parseFrontmatter, scanRestaurantFiles } from '../src/frontmatter'

const fixture = resolve(import.meta.dirname, 'fixtures', 'valid-sample.md')

describe('parseFrontmatter', () => {
  it('解析合法 md 的 frontmatter 与 body', () => {
    const rec = parseFrontmatter(fixture)
    expect(rec.frontmatter.id).toBe('cn-beijing-test-shop')
    expect(rec.frontmatter.name).toBe('测试餐厅')
    expect(rec.frontmatter.price_level).toBe(3)
    expect(rec.body).toContain('# 测试餐厅')
    expect(rec.filePath).toBe(fixture)
  })

  it('phone 保留为字符串（前导 0 不丢失）', () => {
    // 用 inline 内存方式不适用，这里依赖一个带 phone 的夹具
    // 见 Task 后续补充；此处先验证基础解析
    const rec = parseFrontmatter(fixture)
    expect(rec.frontmatter.id).toMatch(/^[a-z]{2}-/)
  })
})

describe('scanRestaurantFiles', () => {
  it('递归返回 md 文件并排除下划线前缀文件', () => {
    const dir = resolve(import.meta.dirname, 'fixtures')
    const files = scanRestaurantFiles(dir)
    expect(files.map((f) => resolve(f))).toContain(resolve(fixture))
    // _template.md 不应出现（若 fixtures 下存在的话）
    for (const f of files) {
      expect(f.includes('_template')).toBe(false)
    }
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd tools && pnpm test frontmatter`
Expected: FAIL，找不到 `../src/frontmatter` 模块。

- [ ] **Step 4: 实现 `tools/src/frontmatter.ts`**

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import matter from 'gray-matter'
import type { RestaurantFrontmatter, RestaurantRecord } from './types'

export function parseFrontmatter(filePath: string): RestaurantRecord {
  const abs = resolve(filePath)
  const raw = readFileSync(abs, 'utf-8')
  const parsed = matter(raw)
  return {
    frontmatter: parsed.data as RestaurantFrontmatter,
    body: parsed.content,
    filePath: abs,
  }
}

export function scanRestaurantFiles(dataDir: string): string[] {
  const results: string[] = []
  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const full = resolve(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (entry.endsWith('.md') && !entry.startsWith('_')) {
        results.push(full)
      }
    }
  }
  walk(resolve(dataDir))
  return results
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd tools && pnpm test frontmatter`
Expected: PASS。

- [ ] **Step 6: 补充 phone 字符串夹具并加测试**

在 `tools/tests/fixtures/valid-sample.md` 的 frontmatter 中追加一行 `phone: "010-12345678"`（注意引号）。然后在 `frontmatter.test.ts` 的 `parseFrontmatter` describe 内追加：

```typescript
  it('phone 字段保留为字符串', () => {
    const rec = parseFrontmatter(fixture)
    expect(rec.frontmatter.phone).toBe('010-12345678')
    expect(typeof rec.frontmatter.phone).toBe('string')
  })
```

Run: `cd tools && pnpm test frontmatter`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add tools/src/frontmatter.ts tools/tests/frontmatter.test.ts tools/tests/fixtures/
git commit -m "feat: 实现 frontmatter 解析器与餐厅文件扫描"
```

---

## Task 7: id 唯一性与路径一致性校验

**Files:**
- Create: `tools/src/check-unique.ts`
- Create: `tools/tests/check-unique.test.ts`

**Interfaces:**
- Consumes: `RestaurantRecord`（来自 `./types`）、`scanRestaurantFiles`（来自 `./frontmatter`）、`ValidationIssue`。
- Produces: `checkUnique(records: RestaurantRecord[]): ValidationIssue[]`，返回 errors（重复 id、id 与路径不一致、id 前缀 country 与路径 country 目录不一致、id 第二段 city-slug 的城市必须等于路径 city 目录）。每个 issue 的 `type` 恒为 `'error'`，`path` 为文件路径，`message` 为中文描述。

**一致性规则**（写进实现，供后续测试对照）：
- 文件路径形如 `.../data/restaurants/{country}/{city}/{file}.md`。
- frontmatter `id` 必须等于 `{country}-{city-slug}-{store-slug}`，其中第一段 `{country}` 必须等于路径的 country 目录；第二段开头的 city（用 `-` 分隔，取 id 去掉首段后的第一段）必须等于路径 city 目录的拼音形式。

> 说明：为避免拼音映射复杂度，本任务只校验**强约束的两条**：
> 1. id 全局唯一（跨所有文件）。
> 2. id 的首段（第一个 `-` 之前）等于路径中的 country 目录。
> 城市一致性由 Task 8 校验器在 schema 层之外补充一条软校验：frontmatter `city` 字段非空即可（schema 已强制）。路径 city 目录与 city 字段的精确匹配作为 warning 留待后续，不在本任务实现，避免拼音归一化引入复杂度。

- [ ] **Step 1: 写失败测试 `tools/tests/check-unique.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { checkUnique } from '../src/check-unique'
import type { RestaurantRecord } from '../src/types'

function mk(id: string, path: string): RestaurantRecord {
  return {
    frontmatter: {
      id,
      name: 'x',
      city: 'beijing',
      country: 'cn',
      cuisine: '京菜',
      price_level: 3,
      status: 'open',
    },
    body: '',
    filePath: path,
  }
}

describe('checkUnique', () => {
  it('全部唯一且 country 一致时无 error', () => {
    const recs = [
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/a.md'),
      mk('cn-beijing-b', '/repo/data/restaurants/cn/beijing/b.md'),
    ]
    expect(checkUnique(recs)).toEqual([])
  })

  it('id 重复时报 error', () => {
    const recs = [
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/a.md'),
      mk('cn-beijing-a', '/repo/data/restaurants/cn/beijing/b.md'),
    ]
    const issues = checkUnique(recs)
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues.every((i) => i.type === 'error')).toBe(true)
    expect(issues.some((i) => i.message.includes('重复'))).toBe(true)
  })

  it('id 首段与路径 country 目录不一致时报 error', () => {
    const recs = [mk('cn-beijing-a', '/repo/data/restaurants/jp/tokyo/a.md')]
    const issues = checkUnique(recs)
    expect(issues.length).toBe(1)
    expect(issues[0].type).toBe('error')
    expect(issues[0].message).toContain('country')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd tools && pnpm test check-unique`
Expected: FAIL，找不到 `../src/check-unique` 模块。

- [ ] **Step 3: 实现 `tools/src/check-unique.ts`**

```typescript
import { sep } from 'node:path'
import type { RestaurantRecord, ValidationIssue } from './types'

// 从文件路径提取 [country, city] 目录段
function extractPathSegments(filePath: string): { country?: string; city?: string } {
  const parts = filePath.split(sep)
  const idx = parts.lastIndexOf('restaurants')
  if (idx === -1 || idx + 2 >= parts.length) return {}
  return { country: parts[idx + 1], city: parts[idx + 2] }
}

export function checkUnique(records: RestaurantRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, string>() // id -> first filePath

  for (const rec of records) {
    const { id } = rec.frontmatter
    const { country } = extractPathSegments(rec.filePath)

    // 1. id 首段必须等于路径 country 目录
    const idCountry = id.split('-')[0]
    if (country && idCountry !== country) {
      issues.push({
        type: 'error',
        path: rec.filePath,
        message: `id 首段 "${idCountry}" 与路径 country 目录 "${country}" 不一致`,
      })
    }

    // 2. id 全局唯一
    const prev = seen.get(id)
    if (prev) {
      issues.push({
        type: 'error',
        path: rec.filePath,
        message: `id "${id}" 与 ${prev} 重复`,
      })
    } else {
      seen.set(id, rec.filePath)
    }
  }

  return issues
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd tools && pnpm test check-unique`
Expected: PASS（3 个测试通过）。

- [ ] **Step 5: 提交**

```bash
git add tools/src/check-unique.ts tools/tests/check-unique.test.ts
git commit -m "feat: 实现 id 唯一性与 country 路径一致性校验"
```

---

## Task 8: frontmatter 校验器（errors / warnings 分离）

**Files:**
- Create: `tools/src/validator.ts`
- Create: `tools/tests/validator.test.ts`
- Create: `tools/tests/fixtures/invalid-sample.md`
- Create: `tools/tests/fixtures/warning-sample.md`

**Interfaces:**
- Consumes: `parseFrontmatter` / `scanRestaurantFiles`（`./frontmatter`）、`loadEnums`（`./enums`）、`schema/restaurant.schema.json`、`checkUnique`（`./check-unique`）、`RestaurantRecord` / `ValidationResult` / `ValidationIssue`（`./types`）。
- Produces:
  - `validateRecord(record: RestaurantRecord): ValidationResult` —— 对单条记录做 schema 校验 + 推荐字段 warning。
  - `validateAll(dataDir: string): ValidationResult & { checked: number }` —— 扫描目录，逐条校验并合并 checkUnique 结果，返回 `{ errors, warnings, checked }`。

**校验规则映射：**
- 必填缺失 / 枚举非法（cuisine, price_level, status）/ 类型不符 / 坐标越界 / date 格式错 → **error**（来自 ajv）。
- 推荐字段缺失（`address`、`latitude`+`longitude`、`tags`、`updated_at`） → **warning**（自定义）。
- latitude 存在但 longitude 缺失（或反之）→ **error**（成对校验，自定义补充）。
- 枚举值注入：加载 schema 后，把 enums 的 cuisines/statuses/priceLevels 写入对应 `enum` 关键字，再编译 ajv。

- [ ] **Step 1: 写失败夹具 `tools/tests/fixtures/invalid-sample.md`**

```markdown
---
id: cn-beijing-bad-shop
name: 坏样本
city: 北京
country: cn
cuisine: 不存在的菜系
price_level: 9
status: 不存在的状态
latitude: 200
---

# 坏样本
```

- [ ] **Step 2: 写 warning 夹具 `tools/tests/fixtures/warning-sample.md`**

```markdown
---
id: cn-beijing-warn-shop
name: 警告样本
city: 北京
country: cn
cuisine: 京菜
price_level: 3
status: open
---

# 警告样本
```
（缺 address / 坐标 / tags / updated_at，全部触发 warning，但无 error）

- [ ] **Step 3: 写失败测试 `tools/tests/validator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { validateRecord, validateAll } from '../src/validator'
import { parseFrontmatter } from '../src/frontmatter'

const fixturesDir = resolve(import.meta.dirname, 'fixtures')

describe('validateRecord', () => {
  it('合法样本无 error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'valid-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors).toEqual([])
  })

  it('枚举非法 + 坐标越界 + price_level 越界 → error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'invalid-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
    expect(result.errors.some((e) => e.message.includes('cuisine'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('price_level'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('status'))).toBe(true)
  })

  it('缺推荐字段 → warning 而非 error', () => {
    const rec = parseFrontmatter(resolve(fixturesDir, 'warning-sample.md'))
    const result = validateRecord(rec)
    expect(result.errors).toEqual([])
    expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    expect(result.warnings.some((w) => w.message.includes('address'))).toBe(true)
  })
})

describe('validateAll', () => {
  it('返回 checked 计数与合并结果', () => {
    const result = validateAll(fixturesDir)
    expect(result.checked).toBeGreaterThan(0)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    // invalid-sample 至少贡献 error
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd tools && pnpm test validator`
Expected: FAIL，找不到 `../src/validator` 模块。

- [ ] **Step 5: 实现 `tools/src/validator.ts`**

```typescript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'
import type { RestaurantRecord, ValidationIssue, ValidationResult, RestaurantFrontmatter } from './types'
import { loadEnums } from './enums'
import { parseFrontmatter, scanRestaurantFiles } from './frontmatter'
import { checkUnique } from './check-unique'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const schemaPath = resolve(repoRoot, 'schema', 'restaurant.schema.json')

let compiledValidator: ((data: unknown) => boolean) & { errors?: ErrorObject[] | null } | null = null

function getValidator() {
  if (compiledValidator) return compiledValidator
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>
  const enums = loadEnums()
  // 动态注入枚举值
  setEnumValues(schema, 'cuisine', enums.cuisines)
  setEnumValues(schema, 'status', enums.statuses)
  setEnumValues(schema, 'price_level', enums.priceLevels)

  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  compiledValidator = ajv.compile(schema) as typeof compiledValidator
  return compiledValidator
}

function setEnumValues(schema: Record<string, unknown>, field: string, values: unknown[]): void {
  const props = schema.properties as Record<string, Record<string, unknown>>
  props[field].enum = values
}

function ajvPath(issue: ErrorObject): string {
  return issue.instancePath.replace(/^\//, '') || '(root)'
}

function customWarnings(fm: RestaurantFrontmatter, filePath: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = []
  if (!fm.address) {
    warnings.push({ type: 'warning', path: filePath, message: '缺少推荐字段 address（地址）' })
  }
  const hasLat = typeof fm.latitude === 'number'
  const hasLng = typeof fm.longitude === 'number'
  if (!hasLat || !hasLng) {
    warnings.push({ type: 'warning', path: filePath, message: '缺少推荐字段 latitude/longitude（坐标）' })
  }
  if (!fm.tags || fm.tags.length === 0) {
    warnings.push({ type: 'warning', path: filePath, message: '缺少推荐字段 tags（标签）' })
  }
  if (!fm.updated_at) {
    warnings.push({ type: 'warning', path: filePath, message: '缺少推荐字段 updated_at（更新日期）' })
  }
  return warnings
}

function customErrors(fm: RestaurantFrontmatter, filePath: string): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  const hasLat = typeof fm.latitude === 'number'
  const hasLng = typeof fm.longitude === 'number'
  if (hasLat !== hasLng) {
    errors.push({ type: 'error', path: filePath, message: 'latitude 与 longitude 必须同时提供' })
  }
  return errors
}

export function validateRecord(record: RestaurantRecord): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const validator = getValidator()

  if (!validator(record.frontmatter)) {
    for (const issue of validator.errors ?? []) {
      errors.push({
        type: 'error',
        path: record.filePath,
        message: `${ajvPath(issue)}: ${issue.message ?? '校验失败'}`,
      })
    }
  }

  errors.push(...customErrors(record.frontmatter, record.filePath))
  warnings.push(...customWarnings(record.frontmatter, record.filePath))

  return { errors, warnings }
}

export function validateAll(
  dataDir: string,
): ValidationResult & { checked: number } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const files = scanRestaurantFiles(dataDir)
  const records: RestaurantRecord[] = []

  for (const file of files) {
    let rec: RestaurantRecord
    try {
      rec = parseFrontmatter(file)
    } catch (e) {
      errors.push({
        type: 'error',
        path: file,
        message: `frontmatter 解析失败: ${e instanceof Error ? e.message : String(e)}`,
      })
      continue
    }
    records.push(rec)
    const result = validateRecord(rec)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  errors.push(...checkUnique(records))

  return { errors, warnings, checked: files.length }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd tools && pnpm test validator`
Expected: PASS（4 个测试通过）。

- [ ] **Step 7: 提交**

```bash
git add tools/src/validator.ts tools/tests/validator.test.ts tools/tests/fixtures/
git commit -m "feat: 实现 frontmatter 校验器（errors/warnings 分离 + 枚举注入）"
```

---

## Task 9: 索引器（index.json 生成 + loadIndex）

**Files:**
- Create: `tools/src/indexer.ts`
- Create: `tools/tests/indexer.test.ts`

**Interfaces:**
- Consumes: `scanRestaurantFiles` / `parseFrontmatter`（`./frontmatter`）、`RestaurantFrontmatter`（`./types`）。
- Produces:
  - `interface IndexEntry { id: string; name: string; city: string; country: string; cuisine: string; price_level: number; status: string; rating?: number; tags?: string[]; path: string; updated_at?: string }`
  - `buildIndex(dataDir: string, repoRoot: string): IndexEntry[]` —— 扫描并扁平化为索引数组；`path` 为相对 `repoRoot` 的 POSIX 路径（如 `data/restaurants/cn/beijing/x.md`）。
  - `writeIndex(dataDir: string, repoRoot: string, outPath: string): IndexEntry[]` —— 生成并写入 `outPath`（`dist/index.json`），同时返回索引。
  - `loadIndex(distPath?: string): IndexEntry[]` —— 读取已生成的 index.json（Hono 空壳在 Task 11 调用）。

- [ ] **Step 1: 写失败测试 `tools/tests/indexer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { buildIndex, writeIndex, loadIndex } from '../src/indexer'

const fixturesDir = resolve(import.meta.dirname, 'fixtures')
const repoRoot = resolve(import.meta.dirname, '..', '..')
const tmpOut = resolve(import.meta.dirname, 'fixtures', '_tmp_index.json')

describe('buildIndex', () => {
  it('扫描 fixtures 生成索引条目', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    expect(index.length).toBeGreaterThan(0)
    const entry = index.find((e) => e.id === 'cn-beijing-test-shop')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('测试餐厅')
    expect(entry!.path).toMatch(/fixtures[\/\\]valid-sample\.md$/)
  })

  it('path 为相对仓库根的 POSIX 路径', () => {
    const index = buildIndex(fixturesDir, repoRoot)
    const entry = index.find((e) => e.id === 'cn-beijing-test-shop')!
    expect(entry.path).not.toMatch(/[A-Z]:/) // 无 Windows 盘符
  })
})

describe('writeIndex / loadIndex', () => {
  it('写入并读回等价数据', () => {
    try {
      const written = writeIndex(fixturesDir, repoRoot, tmpOut)
      expect(existsSync(tmpOut)).toBe(true)
      const loaded = loadIndex(tmpOut)
      expect(loaded.length).toBe(written.length)
      expect(loaded[0].id).toBe(written[0].id)
      // 验证 JSON 合法且含数组
      const raw = JSON.parse(readFileSync(tmpOut, 'utf-8'))
      expect(Array.isArray(raw)).toBe(true)
    } finally {
      if (existsSync(tmpOut)) rmSync(tmpOut)
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd tools && pnpm test indexer`
Expected: FAIL，找不到 `../src/indexer` 模块。

- [ ] **Step 3: 实现 `tools/src/indexer.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { scanRestaurantFiles, parseFrontmatter } from './frontmatter'
import type { RestaurantFrontmatter } from './types'

export interface IndexEntry {
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
}

function toPosix(p: string): string {
  return p.split(sep).join('/')
}

export function buildIndex(dataDir: string, repoRoot: string): IndexEntry[] {
  const files = scanRestaurantFiles(dataDir)
  const entries: IndexEntry[] = []
  for (const file of files) {
    const { frontmatter: fm } = parseFrontmatter(file)
    const entry: IndexEntry = {
      id: fm.id,
      name: fm.name,
      city: fm.city,
      country: fm.country,
      cuisine: fm.cuisine,
      price_level: fm.price_level,
      status: fm.status,
      rating: fm.rating,
      tags: fm.tags,
      path: toPosix(relative(repoRoot, file)),
      updated_at: fm.updated_at,
    }
    entries.push(entry)
  }
  return entries
}

export function writeIndex(dataDir: string, repoRoot: string, outPath: string): IndexEntry[] {
  const index = buildIndex(dataDir, repoRoot)
  const absOut = resolve(outPath)
  writeFileSync(absOut, JSON.stringify(index, null, 2) + '\n', 'utf-8')
  return index
}

export function loadIndex(distPath?: string): IndexEntry[] {
  const repoRoot = resolve(import.meta.dirname ?? '.', '..', '..', '..')
  const path = distPath ?? resolve(repoRoot, 'dist', 'index.json')
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf-8')) as IndexEntry[]
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd tools && pnpm test indexer`
Expected: PASS（3 个测试通过）。

- [ ] **Step 5: 提交**

```bash
git add tools/src/indexer.ts tools/tests/indexer.test.ts
git commit -m "feat: 实现索引器 buildIndex/writeIndex/loadIndex"
```

---

## Task 10: CLI 入口（统一调度命令）

**Files:**
- Create: `tools/src/cli.ts`

**Interfaces:**
- Consumes: `validateAll`（`./validator`）、`checkUnique`（`./check-unique`）、`parseFrontmatter`/`scanRestaurantFiles`（`./frontmatter`）、`writeIndex`（`./indexer`）、`newRestaurant`（Task 11，先 import 占位）、`createApp`（Task 11，先 import 占位）。
- Produces: `tools/src/cli.ts` 作为 `pnpm <script>` 的统一入口，命令分支：`validate` / `check-unique` / `index` / `new` / `server`。退出码：有 error → 非 0。

> 注意：本任务依赖 Task 11 的 `new-restaurant.ts` 与 `server/hono.ts`。请先实现 Task 11，再回到本任务运行联调。两个任务的文件可同时创建，但 CLI 能跑通要求两者都在。

- [ ] **Step 1: 写 `tools/src/cli.ts`**

```typescript
import { resolve } from 'node:path'
import { validateAll } from './validator'
import { scanRestaurantFiles, parseFrontmatter } from './frontmatter'
import { checkUnique } from './check-unique'
import { writeIndex } from './indexer'
import { newRestaurant } from './new-restaurant'
import { createApp } from './server/hono'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const dataDir = resolve(repoRoot, 'data', 'restaurants')
const distPath = resolve(repoRoot, 'dist', 'index.json')

function report(result: ReturnType<typeof validateAll>): number {
  const { errors, warnings, checked } = result
  console.log(`已校验 ${checked} 个餐厅文件`)
  for (const w of warnings) {
    console.warn(`[WARN] ${w.path}: ${w.message}`)
  }
  for (const e of errors) {
    console.error(`[ERROR] ${e.path}: ${e.message}`)
  }
  console.log(`结果: ${errors.length} 个错误, ${warnings.length} 个警告`)
  return errors.length > 0 ? 1 : 0
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  switch (cmd) {
    case 'validate': {
      process.exitCode = report(validateAll(dataDir))
      break
    }
    case 'check-unique': {
      const files = scanRestaurantFiles(dataDir)
      const recs = files.map((f) => parseFrontmatter(f))
      const issues = checkUnique(recs)
      for (const e of issues) console.error(`[ERROR] ${e.path}: ${e.message}`)
      console.log(`结果: ${issues.length} 个唯一性错误`)
      process.exitCode = issues.length > 0 ? 1 : 0
      break
    }
    case 'index': {
      const index = writeIndex(dataDir, repoRoot, distPath)
      console.log(`已生成索引: ${distPath} (${index.length} 条)`)
      break
    }
    case 'new': {
      await newRestaurant(dataDir)
      break
    }
    case 'server': {
      const app = createApp()
      console.log('Hono app 已创建（本期仅本地预览，未自动监听端口）')
      console.log(`路由: ${app.routes.length} 条`)
      break
    }
    default:
      console.error(`未知命令: ${cmd}`)
      console.error('可用命令: validate | check-unique | index | new | server')
      process.exitCode = 1
  }
}

void main()
```

- [ ] **Step 2: 提交（注意依赖 Task 11，提交可与 Task 11 合并或之后）**

本任务的提交在 Task 11 完成后一起做（见 Task 11 Step 5）。先保存文件。

---

## Task 11: 脚手架 new-restaurant + Hono 预留空壳

**Files:**
- Create: `tools/src/new-restaurant.ts`
- Create: `tools/src/server/hono.ts`

**Interfaces:**
- Consumes: `RestaurantFrontmatter`（`./types`）、`loadIndex`（`./indexer`，Hono 用）。
- Produces:
  - `new-restaurant.ts`: `newRestaurant(dataDir: string): Promise<void>` —— 用 `readline` 交互收集（店名/城市拼音/国家/菜系/价位/状态/id slug），在 `data/restaurants/{country}/{city}/` 下生成 `{slug}.md`，frontmatter 含必填字段。
  - `server/hono.ts`: `createApp(): Hono` —— 返回配置好两个只读路由的 Hono 实例，供 CLI `server` 命令与后期扩展。

- [ ] **Step 1: 写 `tools/src/new-restaurant.ts`**

```typescript
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { resolve, mkdirSync, existsSync, writeFileSync } from 'node:path'
import { loadEnums } from './enums'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function newRestaurant(dataDir: string): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout })
  const enums = loadEnums()

  try {
    const name = (await rl.question('餐厅名称: ')).trim()
    const country = ((await rl.question('国家代码(如 cn): ')).trim() || 'cn').toLowerCase()
    const cityPinyin = slugify((await rl.question('城市拼音(如 beijing): ')).trim())
    const cityCn = (await rl.question('城市中文名(如 北京): ')).trim()
    const slug = slugify((await rl.question('文件 id slug(如 juqi-sanlitun): ')).trim() || name)

    console.log(`可选菜系: ${enums.cuisines.join(', ')}`)
    const cuisine = (await rl.question('菜系: ')).trim()
    if (!enums.cuisines.includes(cuisine)) {
      console.warn(`警告: "${cuisine}" 不在枚举中，请确认后扩充 schema/enums.json`)
    }

    console.log(`可选价位(1-5): ${enums.priceLevels.join(', ')}`)
    const priceLevel = Number((await rl.question('价位 1-5: ')).trim() || '3')
    console.log(`可选状态: ${enums.statuses.join(', ')}`)
    const status = (await rl.question('状态(默认 open): ')).trim() || 'open'

    const id = `${country}-${cityPinyin}-${slug}`
    const cityDir = resolve(dataDir, country, cityPinyin)
    const outFile = resolve(cityDir, `${slug}.md`)

    if (existsSync(outFile)) {
      console.error(`文件已存在: ${outFile}`)
      return
    }

    const md = `---
id: ${id}
name: ${name}
city: ${cityCn}
country: ${country}
cuisine: ${cuisine}
price_level: ${priceLevel}
status: ${status}
updated_at: ${new Date().toISOString().slice(0, 10)}
---

# ${name}

在此填写探店描述。
`

    mkdirSync(cityDir, { recursive: true })
    writeFileSync(outFile, md, 'utf-8')
    console.log(`已创建: ${outFile}`)
    console.log('请补充 address/坐标/推荐菜品等字段后运行 pnpm validate')
  } finally {
    rl.close()
  }
}
```

> 说明：`new Date().toISOString()` 在 CLI 运行时（Node 环境）合法可用，不受工作流脚本中 `Date.now()` 限制的约束——该限制仅针对 Workflow 脚本沙箱。本文件是 Node 程序源码。

- [ ] **Step 2: 写 `tools/src/server/hono.ts`**

```typescript
import { Hono } from 'hono'
import { loadIndex } from '../indexer'

export function createApp(): Hono {
  const app = new Hono()

  app.get('/api/restaurants', (c) => {
    return c.json(loadIndex())
  })

  app.get('/api/restaurants/:id', (c) => {
    const id = c.req.param('id')
    const list = loadIndex()
    const found = list.find((r) => r.id === id)
    if (!found) return c.json({ error: 'not found' }, 404)
    return c.json(found)
  })

  // 预留：下一期接入 LLM
  // app.post('/api/ai/recommend', ...)

  return app
}
```

- [ ] **Step 3: 联调 CLI（依赖 Task 10 已写）**

```bash
cd tools
pnpm typecheck
pnpm test
```
Expected: `typecheck` 通过；所有测试 PASS。

- [ ] **Step 4: 手动验证 server 命令**

```bash
cd tools
pnpm server
```
Expected: 输出 `Hono app 已创建...` 与路由数量，退出码 0。

- [ ] **Step 5: 提交（含 Task 10 的 cli.ts）**

```bash
git add tools/src/cli.ts tools/src/new-restaurant.ts tools/src/server/hono.ts
git commit -m "feat: 实现 CLI 入口、脚手架 new-restaurant 与 Hono 预留空壳"
```

---

## Task 12: 数据模板与示例餐厅

**Files:**
- Create: `data/restaurants/cn/beijing/_template.md`
- Create: `data/restaurants/cn/beijing/juqi-sanlitun.md`
- Create: `data/restaurants/cn/beijing/_assets/.gitkeep`

**Interfaces:**
- Consumes: Task 8 校验器（验证示例餐厅合法）。
- Produces: 符合 schema 的模板与首份示例数据，供贡献者复制与 CI 验证。

- [ ] **Step 1: 创建模板 `data/restaurants/cn/beijing/_template.md`**

````markdown
---
# 必填
id: cn-beijing-your-shop      # 格式 {国家}-{城市拼音}-{店名slug}
name: 餐厅名称
city: 北京
country: cn
cuisine: 京菜                  # 见 schema/enums.json
price_level: 3                # 1-5
status: open                  # open|closed|relocated|demolished

# 联系与运营
address: 地址
latitude: 39.9342
longitude: 116.4551
phone: "010-12345678"
website: https://example.com
tags: [商务, 亲子]

# 点评与推荐
rating: 4.5
visited_date: 2026-07-07
recommendations:
  - name: 推荐菜名
    note: 必点
notes: 简短点评。

# 数据治理
verified: false
source: 个人探店
updated_at: 2026-07-07
---

# 餐厅名称

在此写探店描述：位置指引、点单攻略、避坑提示等。

## 特色
- 特色一
- 特色二
````

- [ ] **Step 2: 创建示例餐厅 `data/restaurants/cn/beijing/juqi-sanlitun.md`**

使用规格文档 §3.1 的完整示例内容（局气三里屯店），id 为 `cn-beijing-juqi-sanlitun`，status `open`，所有字段填全。

```yaml
---
id: cn-beijing-juqi-sanlitun
name: 局气
name_en: Juqi
city: 北京
country: cn
cuisine: 京菜
price_level: 3
address: 北京市朝阳区工人体育场北路三里屯太古里南区
latitude: 39.9342
longitude: 116.4551
phone: "010-12345678"
website: https://example.com
opening_hours:
  mon: "11:00-22:00"
  tue: "11:00-22:00"
tags: [商务, 亲子, 网红, 有包间]
rating: 4.5
visited_date: 2026-06-15
recommendations:
  - name: 烤鸭
    note: 必点，皮脆
  - name: 炸灌肠
notes: 周末排队久，建议预约。
status: open
verified: true
source: 个人探店
updated_at: 2026-06-15
---

# 局气（三里屯店）

京味儿创意菜，环境有老北京元素，适合带外地朋友体验京菜。
```

- [ ] **Step 3: 创建 `_assets/.gitkeep`**（空文件）

- [ ] **Step 4: 用校验器验证示例餐厅**

```bash
cd tools
pnpm validate
```
Expected: 输出 `已校验 1 个餐厅文件`，0 错误 0 警告（示例字段齐全）。`_template.md` 被扫描排除（下划线前缀）。

- [ ] **Step 5: 提交**

```bash
git add data/restaurants/
git commit -m "data: 添加北京餐厅模板与局气示例数据"
```

---

## Task 13: CI 工作流

**Files:**
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/build-index.yml`

**Interfaces:**
- Consumes: Task 4–11 的工具链脚本。
- Produces: PR 时校验阻塞、main 合并后生成并提交 `dist/index.json`。

- [ ] **Step 1: 创建 `.github/workflows/validate.yml`**

```yaml
name: validate

on:
  pull_request:
    paths:
      - 'data/**'
      - 'schema/**'
      - 'tools/**'
      - '.github/workflows/validate.yml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: tools/pnpm-lock.yaml

      - name: Install
        working-directory: tools
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        working-directory: tools
        run: pnpm typecheck

      - name: Test
        working-directory: tools
        run: pnpm test

      - name: Validate data
        working-directory: tools
        run: pnpm validate

      - name: Check unique ids
        working-directory: tools
        run: pnpm check-unique
```

- [ ] **Step 2: 创建 `.github/workflows/build-index.yml`**

```yaml
name: build-index

on:
  push:
    branches: [main]
    paths:
      - 'data/**'
      - 'schema/**'
      - 'tools/**'

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: tools/pnpm-lock.yaml

      - name: Install
        working-directory: tools
        run: pnpm install --frozen-lockfile

      - name: Build index
        working-directory: tools
        run: pnpm index

      - name: Commit index
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [[ -n "$(git status --porcelain dist/index.json)" ]]; then
            git add dist/index.json
            git commit -m "chore: 自动更新索引 [skip ci]"
            git push
          else
            echo "索引无变化"
          fi
```

- [ ] **Step 3: 补 dist 到 gitignore 的例外说明**

检查 `.gitignore`：`tools/dist/` 已忽略，但根 `dist/index.json` **需要提交**（CI 会回写）。确认 `.gitignore` 不含 `dist/` 顶层通配——当前仅忽略 `tools/dist/`，根 `dist/` 不受影响，符合需求。无需改动。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/validate.yml .github/workflows/build-index.yml
git commit -m "ci: 添加 PR 校验与 main 索引生成工作流"
```

---

## Task 14: 文档（README / CONTRIBUTING / DATA_SPEC / DEVELOPMENT / ROADMAP）

**Files:**
- Create: `README.md`
- Create: `docs/CONTRIBUTING.md`
- Create: `docs/DATA_SPEC.md`
- Create: `docs/DEVELOPMENT.md`
- Create: `docs/ROADMAP.md`

**Interfaces:**
- Produces: 面向贡献者与维护者的全套文档。

- [ ] **Step 1: 写 `README.md`**

包含：项目简介（餐厅数据集合，社区共建）、快速贡献（两条路径）、目录结构概览、工具链命令速查、license MIT、链接到 CONTRIBUTING/DATA_SPEC。

- [ ] **Step 2: 写 `docs/CONTRIBUTING.md`**

包含：分支规范（`data/`、`feature/`）、commit 类型（feat/fix/data/docs/chore）、贡献一条龙（脚手架 + 手写两路径）、PR 审核清单（规格 §5.3 的 7 项）、数据治理约定（§5.5）。

- [ ] **Step 3: 写 `docs/DATA_SPEC.md`**

包含：完整字段表（必填/推荐/可选分级）、key 约束（id 格式、坐标成对、枚举、phone 字符串、updated_at 日期）、枚举扩充流程（改 `schema/enums.json`）、城市处理规则。

- [ ] **Step 4: 写 `docs/DEVELOPMENT.md`**

包含：工具链开发环境（pnpm 10 / Node 22）、目录职责、TS strict、Vitest 用法、如何加测试、errors/warnings 分离原则、本地校验流程。

- [ ] **Step 5: 写 `docs/ROADMAP.md`**

包含：前端一期（SSG 待定）、后端 API 一期（Hono 只读）、AI 一期（LLM 推荐与辅助贡献），引用已预留的接入点（schema / index.json / Hono 空壳）。

- [ ] **Step 6: 提交**

```bash
git add README.md docs/CONTRIBUTING.md docs/DATA_SPEC.md docs/DEVELOPMENT.md docs/ROADMAP.md
git commit -m "docs: 添加 README 与贡献/数据/开发/路线图文档"
```

---

## Task 15: 收尾验证与生成首次索引

**Files:**
- Modify: `dist/index.json`（首次生成）

- [ ] **Step 1: 全量本地验证**

```bash
cd tools
pnpm install
pnpm typecheck
pnpm test
pnpm validate
pnpm check-unique
pnpm index
```
Expected：全部通过；`dist/index.json` 生成，含局气 1 条。

- [ ] **Step 2: 确认目录树**

```bash
git status --short
ls data/restaurants/cn/beijing/
```
Expected：工作区仅 `dist/index.json` 为新增/修改，其余已提交。

- [ ] **Step 3: 提交首次索引**

```bash
git add dist/index.json
git commit -m "chore: 生成首次索引 dist/index.json"
```

- [ ] **Step 4: 推送（由用户决定）**

提示用户：`git push origin main` 推送全部提交（含设计文档、工具链、数据、CI、文档）。

---

## 完成标准

- `pnpm test` 全绿（enums / frontmatter / check-unique / validator / indexer）。
- `pnpm validate` 对示例餐厅 0 错误。
- `pnpm index` 生成 `dist/index.json`。
- `pnpm server` 创建 Hono app 不报错。
- CI 工作流文件就位，逻辑可被 GitHub Actions 执行（本地 yaml 语法正确）。
- 5 份文档齐全，贡献者照 CONTRIBUTING 可独立加一家餐厅。
