import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { resolve } from 'node:path'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
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
