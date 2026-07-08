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
