import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// 收藏清单：纯前端 localStorage 持久化，无账号同步。
const STORAGE_KEY = 'ai4food:favorites'

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref<string[]>(loadFromStorage())
  const count = computed(() => ids.value.length)

  // 同步 watch：增删后立即写回 localStorage（实时持久化，页面突然关闭也不丢；
  // 收藏是低频操作，同步开销可忽略）。隐私模式/配额满静默忽略。
  watch(
    ids,
    (val) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      } catch {
        // 静默
      }
    },
    { deep: true, flush: 'sync' },
  )

  function has(id: string): boolean {
    return ids.value.includes(id)
  }

  function toggle(id: string): void {
    // 替换整个数组以可靠触发响应式
    ids.value = ids.value.includes(id) ? ids.value.filter((x) => x !== id) : [...ids.value, id]
  }

  function clear(): void {
    ids.value = []
  }

  return { ids, count, has, toggle, clear }
})
