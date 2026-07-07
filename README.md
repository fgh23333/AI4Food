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
├── dist/index.json                                # 索引产物（CI 生成）
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

1. 复制 `data/restaurants/cn/beijing/_template.md` 到对应城市目录
2. 修改 frontmatter（必填字段不能少）
3. 运行 `pnpm validate` 本地校验
4. 文件命名 `<店名拼音>-<分店>.md`，如 `juqi-sanlitun.md`
5. 提交 PR，标题 `data: 新增<城市><店名>`

📖 完整流程见 [贡献指南](docs/CONTRIBUTING.md)，字段说明见 [数据规范](docs/DATA_SPEC.md)。

---

## 📋 数据字段速查

| 分级 | 字段 | 说明 |
|------|------|------|
| **必填** | `id`, `name`, `city`, `country`, `cuisine`, `price_level`, `status` | 缺失则校验失败 |
| **推荐** | `address`, `latitude`+`longitude`, `tags`, `updated_at` | 缺失仅警告 |
| **可选** | `rating`, `recommendations`, `notes`, `photos`, `phone`, `opening_hours` | 自由填写 |

示例（局气三里屯店）：

```yaml
---
id: cn-beijing-juqi-sanlitun
name: 局气
city: 北京
country: cn
cuisine: 京菜
price_level: 3
status: open
address: 北京市朝阳区三里屯太古里南区
latitude: 39.9342
longitude: 116.4551
rating: 4.5
updated_at: 2026-06-15
---

# 局气（三里屯店）

京味儿创意菜，环境有老北京元素……
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

## 🗺️ 路线图

**本期（数据仓库一期）**：数据格式、schema、校验工具链、CI、贡献流程。

**后续规划**（见 [ROADMAP](docs/ROADMAP.md)）：
- 🖥️ 前端展示网站（地图 / 列表 / 筛选）
- 🔌 后端只读 API（基于 Hono）
- 🤖 AI 美食助手（智能推荐 + 辅助贡献）

本期设计已为上述内容预留接入点，不会推翻重来。

---

## 🤝 参与贡献

欢迎贡献你探店过的餐厅！请先阅读 [贡献指南](docs/CONTRIBUTING.md)。

- 加餐厅 → 分支 `data/<城市>-<店名>`
- 改工具/文档 → 分支 `feature/<主题>`
- commit 类型：`feat` / `fix` / `data` / `docs` / `chore`

---

## 📄 许可证

[MIT](LICENSE)
