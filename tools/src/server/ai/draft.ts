import type { IndexEntry, RestaurantEnums, RestaurantDraft, DraftResponse } from '../../types'
import { buildDraftPrompt } from './prompt'
import { parseJsonResponse, type LlmClient } from './llm'

// 枚举越界时的默认值
const DEFAULT_CUISINE = '其他'
const DEFAULT_STATUS = 'open'
const DEFAULT_PRICE = 3

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// 草稿编排：buildPrompt -> llm -> parseJson -> 枚举校验 -> 必填检查 -> 响应。
// 不写文件，只生成草稿 JSON 供人工核对。
export async function draft(
  description: string,
  entries: IndexEntry[],
  enums: RestaurantEnums,
  llm: LlmClient,
): Promise<DraftResponse> {
  const warnings: string[] = []

  // 1. 构建提示词
  const { system, user } = buildDraftPrompt(description, enums)

  // 2. 调 LLM
  const { text, model } = await llm.run({ system, user })

  // 3. 解析 JSON
  const parsed = parseJsonResponse(text)
  if (!isObj(parsed)) {
    throw new Error('LLM 草稿响应不是 JSON 对象')
  }

  // 4. 枚举校验
  let cuisine: string
  if (typeof parsed.cuisine === 'string' && enums.cuisines.includes(parsed.cuisine)) {
    cuisine = parsed.cuisine
  } else {
    cuisine = DEFAULT_CUISINE
    warnings.push(`菜系（cuisine）值无效或缺失，已置默认「${DEFAULT_CUISINE}」`)
  }

  let status: string
  if (typeof parsed.status === 'string' && enums.statuses.includes(parsed.status)) {
    status = parsed.status
  } else {
    status = DEFAULT_STATUS
    warnings.push(`营业状态（status）值无效或缺失，已置默认「${DEFAULT_STATUS}」`)
  }

  let priceLevel: number
  if (
    typeof parsed.price_level === 'number' &&
    Number.isInteger(parsed.price_level) &&
    enums.priceLevels.includes(parsed.price_level)
  ) {
    priceLevel = parsed.price_level
  } else {
    priceLevel = DEFAULT_PRICE
    warnings.push(`价位（price_level）值无效或缺失，已置默认 ${DEFAULT_PRICE}`)
  }

  // 5. 必填字段检查
  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : ''
  if (!name) {
    warnings.push('名称（name）缺失，需人工补充')
  }

  // 6. 可选字段
  const optionalFields: RestaurantDraft = {
    name,
    cuisine,
    price_level: priceLevel,
    status,
  }
  if (typeof parsed.city === 'string' && parsed.city) optionalFields.city = parsed.city
  if (typeof parsed.country === 'string' && parsed.country) optionalFields.country = parsed.country
  if (Array.isArray(parsed.tags)) {
    const tags = parsed.tags.filter((t): t is string => typeof t === 'string')
    if (tags.length) optionalFields.tags = tags
  }
  if (typeof parsed.address === 'string' && parsed.address) {
    optionalFields.address = parsed.address
  } else {
    warnings.push('地址（address）未提供，需人工补充')
  }
  if (typeof parsed.phone === 'string' && parsed.phone) {
    optionalFields.phone = parsed.phone
  } else {
    warnings.push('电话（phone）未提供，需人工补充')
  }
  if (typeof parsed.notes === 'string' && parsed.notes) optionalFields.notes = parsed.notes
  if (typeof parsed.description === 'string' && parsed.description) {
    optionalFields.description = parsed.description
  }

  // entries 参数当前用于未来 id 唯一性检查预留（本期草稿不生成 id，由人工落盘时定）
  void entries

  return { draft: optionalFields, warnings, model }
}
