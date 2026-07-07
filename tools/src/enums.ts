import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { RestaurantEnums } from './types'

// tools/src/enums.ts → 仓库根 schema/enums.json（src → tools → 仓库根，退 2 层）
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function loadEnums(): RestaurantEnums {
  const raw = readFileSync(resolve(repoRoot, 'schema', 'enums.json'), 'utf-8')
  const data = JSON.parse(raw) as RestaurantEnums
  return {
    cuisines: data.cuisines,
    statuses: data.statuses,
    priceLevels: data.priceLevels,
  }
}
