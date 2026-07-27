import type { IndexEntry } from '../types'

// 数据加载抽象：Node 与 Worker 各自实现，hono.ts 只依赖此接口。
export interface DataLoader {
  loadAll(): Promise<IndexEntry[]>
}

// 最小化 KV JSON 读取契约，避免引入完整的 workers 类型污染 Node 工具链。
// Worker 侧的 KVNamespace 满足此接口。
interface KvJsonReader {
  get(key: string, type: 'json'): Promise<unknown | null>
}

// Worker 实现：从 KV 读取 index.json。
// KV 本身有全球边缘缓存，无需模块级缓存；数据更新通过 kv put 生效，无需重部署 Worker。
export function createWorkerLoader(kv: KvJsonReader): DataLoader {
  return {
    async loadAll(): Promise<IndexEntry[]> {
      const raw = await kv.get('index', 'json')
      if (raw === null) {
        throw new Error('KV key "index" 不存在')
      }
      const data = raw as IndexEntry[]
      return Array.isArray(data) ? data : []
    },
  }
}
