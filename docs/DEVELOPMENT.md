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
│   ├── types.ts           # 共享类型定义
│   ├── enums.ts           # loadEnums: 从 schema/enums.json 读取
│   ├── frontmatter.ts     # parseFrontmatter + scanRestaurantFiles
│   ├── check-unique.ts    # id 唯一性与路径一致性校验
│   ├── validator.ts       # validateRecord + validateAll（errors/warnings）
│   ├── indexer.ts         # buildIndex + writeIndex + loadIndex
│   ├── new-restaurant.ts  # 交互式脚手架
│   ├── cli.ts             # 命令入口（validate/index/new/server...）
│   └── server/hono.ts     # Hono 预留 API 空壳
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
| `pnpm run server` | 创建 Hono app（本期仅本地预览） |
| `pnpm test` | 运行 Vitest 测试 |
| `pnpm typecheck` | TypeScript 类型检查 |

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

## 本期不做的事

- ❌ 不实现前端网站（SSG / 地图 / 列表）
- ❌ 不给 Hono 接入 LLM 或部署 API
- ❌ 不引入 Git LFS、SSR 框架、monorepo 工具

这些属于后续规划，见 [ROADMAP.md](./ROADMAP.md)。
