# 数据字段规范

每家餐厅一个 Markdown 文件，frontmatter（YAML）存结构化字段，正文写探店描述。
权威 schema 在 [`schema/restaurant.schema.json`](../schema/restaurant.schema.json)，本文件是它的可读说明。

> 字段定义的唯一事实来源是 `schema/restaurant.schema.json`。若本文与 schema 不一致，**以 schema 为准**。

---

## 文件位置与命名

```
data/restaurants/{country}/{city拼音}/{店名slug}-{分店}.md
```

- `country`：ISO 3166-1 alpha-2 小写，如 `cn`、`jp`、`us`。
- `city拼音`：城市拼音或英文名，如 `shanghai`、`hangzhou`。
- 文件名：`<店名拼音>-<分店>.md`，如 `laoshanghai-nanjingroad.md`。

**强约束**：路径中的 `country` 目录必须等于 frontmatter `id` 的首段（如路径 `cn/...` 对应 id `cn-...`）。

---

## 字段分级

### 必填（缺失 → error，阻塞 PR）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 全局唯一，格式 `{country}-{city-slug}-{store-slug}`，正则 `^[a-z]{2}-[a-z0-9-]+$` |
| `name` | string | 餐厅名称（中文） |
| `city` | string | 城市名 |
| `country` | string | ISO 国家码，2 位小写字母 |
| `cuisine` | string | 菜系，取 `schema/enums.json` 的 cuisines 枚举 |
| `price_level` | integer | 人均价位 1-5（见下表），取枚举 |
| `status` | string | 营业状态，枚举 `open` / `closed` / `relocated` / `demolished` |

**price_level 含义**：1 人均 <50 / 2: 50-100 / 3: 100-200 / 4: 200-500 / 5: >500（元）。

### 推荐（缺失 → warning，不阻塞）

| 字段 | 类型 | 说明 |
|------|------|------|
| `address` | string | 详细地址 |
| `latitude` + `longitude` | number | 经纬度坐标，**必须成对**（只填一个 → error） |
| `tags` | string[] | 标签，如 `[商务, 亲子, 网红]` |
| `updated_at` | string | 最后更新日期 `YYYY-MM-DD` |

### 可选

| 字段 | 类型 | 说明 |
|------|------|------|
| `name_en` | string | 英文名 |
| `phone` | string | 电话，**必须用引号包成字符串**（如 `"010-12345678"`，避免前导 0 丢失） |
| `website` | string | 官网 URL |
| `opening_hours` | object | 键为 `mon`/`tue`/...，值如 `"11:00-22:00"` |
| `rating` | number | 评分 0-5，半分制（0.5 的倍数） |
| `visited_date` | string | 到访日期 `YYYY-MM-DD` |
| `recommendations` | array | 推荐菜品，每项 `{name, note?}` |
| `notes` | string | 简短点评 |
| `photos` | string[] | 图片相对路径，存 `./_assets/xxx.jpg` |
| `verified` | boolean | 信息是否人工核实 |
| `source` | string | 来源：个人探店 / 大众点评 / 官网 / 媒体报道 |

---

## 关键约束

- **日期**：`updated_at` / `visited_date` 必须是 `YYYY-MM-DD` 格式字符串。YAML 会把裸日期解析成 Date 对象，工具链已统一归一化为字符串，但**手写时建议加引号**避免歧义（如 `"2026-07-07"`）。
- **phone**：强制字符串，务必加引号。
- **坐标**：`latitude` 范围 -90~90，`longitude` 范围 -180~180；二者必须同时提供或同时缺省。
- **枚举值**：`cuisine` / `status` / `price_level` 取 `schema/enums.json`，自由填值会报 error。

---

## 城市处理

城市**不在 schema 强制枚举**——城市太多会阻塞新地区贡献。改用：

- `city` 用自由字符串（中文名）。
- 文件路径强约束：路径里的城市拼音目录名对应 frontmatter `city`（如 `shanghai/` ↔ `city: 上海`）。

## 枚举扩充流程

要加新菜系或状态：

1. 编辑 [`schema/enums.json`](../schema/enums.json)，在对应数组里加值。
2. 提 PR，commit 类型 `feat`，标题如 `feat: 枚举新增 福建菜`。
3. 校验器会自动从 enums.json 读取，无需改代码。
