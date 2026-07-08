import type { DataLoader } from './loader'
import type { IndexEntry } from '../types'
import { loadIndex } from '../indexer'

// Node 实现：复用现有 loadIndex（fs 读 dist/index.json）。CLI 本地联调用。
// 独立成文件以隔离 node:fs 依赖，避免污染 Worker 运行时路径（loader.ts 保持纯净）。
export const nodeLoader: DataLoader = {
  async loadAll(): Promise<IndexEntry[]> {
    return loadIndex()
  },
}
