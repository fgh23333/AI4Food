import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'
import type {
  RestaurantRecord,
  ValidationIssue,
  ValidationResult,
  RestaurantFrontmatter,
} from './types'
import { loadEnums } from './enums'
import { parseFrontmatter, scanRestaurantFiles } from './frontmatter'
import { checkUnique } from './check-unique'

// src/validator.ts → 仓库根（src → tools → 仓库根，退 2 层）
const repoRoot = resolve(import.meta.dirname, '..', '..')
const schemaPath = resolve(repoRoot, 'schema', 'restaurant.schema.json')

type CompiledValidator = (data: unknown) => boolean
let compiledValidator: CompiledValidator | null = null
let lastErrors: ErrorObject[] | null = null

function getValidator(): CompiledValidator {
  if (compiledValidator) return compiledValidator

  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>
  const enums = loadEnums()
  setEnumValues(schema, 'cuisine', enums.cuisines)
  setEnumValues(schema, 'status', enums.statuses)
  setEnumValues(schema, 'price_level', enums.priceLevels)

  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile(schema) as (data: unknown) => boolean
  const wrapped = ((data: unknown): boolean => {
    const ok = validate(data)
    lastErrors = validate.errors
    return ok
  }) as CompiledValidator
  compiledValidator = wrapped
  return wrapped
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
    for (const issue of lastErrors ?? []) {
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
