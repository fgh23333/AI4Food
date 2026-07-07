# 贡献指南

欢迎为 AI4Food 贡献餐厅数据！本指南帮助你规范地新增或修改餐厅。

---

## 分支规范

所有贡献通过 PR 合入 `main`，不要直接推送。分支命名遵循两种前缀：

| 分支前缀 | 用途 | 示例 |
|---------|------|------|
| `data/<城市>-<店名>` | 所有餐厅数据贡献（增/改/删） | `data/beijing-juqi` |
| `feature/<主题>` | 工具、文档、修复、维护 | `feature/fix-validator` |

## Commit 规范

遵循 Conventional Commits，类型限定 5 种，描述用中文：

| 类型 | 用法 | 示例 |
|------|------|------|
| `feat` | 工具链/schema/CI 新增能力 | `feat: 校验器支持营业时间校验` |
| `fix` | 修复 bug（含紧急修复） | `fix: 修复 longitude 越界未报错` |
| `data` | 餐厅数据的增/改/删 | `data: 新增北京局气三里屯店` |
| `docs` | 文档变更 | `docs: 补充贡献流程` |
| `chore` | 杂项维护 | `chore: 升级 typescript` |

一条 PR 只做一件事——加餐厅就只加餐厅，别混着改工具。

---

## 贡献一条龙

### 方式 A：交互式脚手架（推荐新手）

```bash
git clone https://github.com/fgh23333/AI4Food.git
cd AI4Food/tools
pnpm install
pnpm run new          # 回答几个问题，自动生成 md
# 编辑生成的 md，补充正文与推荐菜品
pnpm run validate     # 本地校验
```

脚手架会在 `data/restaurants/{国家}/{城市拼音}/` 下创建文件，并填好必填字段。

### 方式 B：手写

1. 复制 `data/restaurants/cn/beijing/_template.md` 到对应城市目录
2. 修改 frontmatter（必填字段不能少）
3. 运行 `pnpm run validate` 本地校验
4. 文件命名 `<店名拼音>-<分店>.md`，如 `juqi-sanlitun.md`
5. 提 PR，标题 `data: 新增<城市><店名>`

> 贡献者不需要懂 TypeScript——工具链是透明黑盒。字段说明见 [DATA_SPEC.md](./DATA_SPEC.md)。

---

## PR 审核清单

提 PR 时请对照此清单自查，维护者按此 review：

- [ ] id 唯一且与文件路径一致（id 首段 = 路径 country 目录）
- [ ] 必填字段完整（`name` / `city` / `country` / `cuisine` / `price_level` / `status`）
- [ ] 坐标成对且范围合法（若填了经纬度）
- [ ] `cuisine` / `status` / `price_level` 用了枚举值
- [ ] `updated_at` 已填写
- [ ] 正文有探店描述（非空 body）
- [ ] CI `validate` 与 `check-unique` 通过

---

## 数据治理约定

- **歇业不删**：`status` 改为 `closed` / `relocated` / `demolished` 的餐厅**保留**并改状态，不删除文件（保留历史）。
- **分店去重**：同店不同分店是不同 `id`（带分店后缀，如 `juqi-sanlitun`、`juqi-wangjing`）；同一分店禁止重复文件。
- **冲突仲裁**：主观字段（rating/notes）以最近更新者为准；客观字段（地址/电话）以 `verified: true` 来源优先。
- **图片**：小图存 `data/.../_assets/`，大图走外链。本期不引入 Git LFS。
- **扩充枚举**：要加新菜系/状态/价位，单独提 PR 改 `schema/enums.json`。
