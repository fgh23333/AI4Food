import type { IndexEntry } from '../types'

// Cloudflare 资产绑定的最小契约（等价于 Workers 全局 Fetcher 类型，
// 在此本地声明以避免主 tsconfig 全局注入 workers 类型污染 Node 工具链）。
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

// 数据加载抽象：Node 与 Worker 各自实现，hono.ts 只依赖此接口。
export interface DataLoader {
  loadAll(): Promise<IndexEntry[]>
}

// Worker 实现：通过 ASSETS 绑定 fetch index.json。
// 带模块级缓存，Worker 实例内只读一次。
// 注意：此文件不 import node:fs，保持 Worker 运行时纯净。
export function createWorkerLoader(assets: AssetFetcher): DataLoader {
  let cache: IndexEntry[] | null = null
  return {
    async loadAll(): Promise<IndexEntry[]> {
      if (cache !== null) return cache
      // 资产绑定用任意合法 URL 取路径部分；index.json 在 assets 目录根
      const res = await assets.fetch(new Request('http://local/index.json'))
      if (!res.ok) {
        throw new Error(`无法加载 index.json: HTTP ${res.status}`)
      }
      const data = (await res.json()) as IndexEntry[]
      cache = Array.isArray(data) ? data : []
      return cache
    },
  }
}
