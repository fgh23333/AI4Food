import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { validateAll } from './validator'
import { scanRestaurantFiles, parseFrontmatter } from './frontmatter'
import { checkUnique } from './check-unique'
import { writeIndex } from './indexer'
import { newRestaurant } from './new-restaurant'
import { createApp } from './server/hono'
import { nodeLoader } from './server/loader-node'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const dataDir = resolve(repoRoot, 'data', 'restaurants')
const distPath = resolve(repoRoot, 'dist', 'index.json')

function report(
  result: ReturnType<typeof validateAll>,
): number {
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
      mkdirSync(resolve(distPath, '..'), { recursive: true })
      const index = writeIndex(dataDir, repoRoot, distPath)
      console.log(`已生成索引: ${distPath} (${index.length} 条)`)
      break
    }
    case 'new': {
      await newRestaurant(dataDir)
      break
    }
    case 'server': {
      const { serve } = await import('@hono/node-server')
      const app = createApp(nodeLoader)
      const port = Number(process.env.PORT ?? 8787)
      serve({ fetch: app.fetch.bind(app), port }, (info) => {
        console.log(`API 运行于 http://localhost:${info.port}`)
        console.log('端点: GET /api/restaurants · GET /api/restaurants/:id · GET /api/meta')
      })
      break
    }
    default:
      console.error(`未知命令: ${cmd}`)
      console.error('可用命令: validate | check-unique | index | new | server')
      process.exitCode = 1
  }
}

void main()
