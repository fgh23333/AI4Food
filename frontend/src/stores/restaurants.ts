import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RestaurantEntry, DisplayItem } from '@/types/restaurant'
import { filterRestaurants } from '@/composables/useFilter'
import { toDisplayItems, brandKey, branchClosed } from '@/composables/useChains'
import { fetchRestaurants } from '@/lib/api'
import { requestPosition } from '@/composables/useGeolocation'
import { sortByDistance as sortByDistanceFn, type LatLng } from '@/lib/distance'

export const useRestaurantsStore = defineStore('restaurants', () => {
  const all = ref<RestaurantEntry[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const query = ref('')
  const cuisine = ref('')
  const price = ref(0)
  const onlyOpen = ref(true)
  const mergeChains = ref(true)

  // 距离排序：基于浏览器定位
  const userLocation = ref<LatLng | null>(null)
  const distanceSort = ref(false)
  const locating = ref(false)

  const filtered = computed(() =>
    filterRestaurants(all.value, {
      query: query.value,
      cuisine: cuisine.value,
      price: price.value,
      onlyOpen: onlyOpen.value,
    })
  )
  const visible = computed<DisplayItem[]>(() => {
    // 距离排序作用在 filter 之后、连锁合并之前：最近分店先出现 → 连锁组排前
    const entries =
      distanceSort.value && userLocation.value
        ? sortByDistanceFn(filtered.value, userLocation.value).map((x) => x.item)
        : filtered.value
    return toDisplayItems(entries, mergeChains.value)
  })

  const chainKeys = computed(() => {
    const c = new Map<string, number>()
    for (const e of all.value) c.set(brandKey(e), (c.get(brandKey(e)) ?? 0) + 1)
    return new Set([...c.entries()].filter(([, n]) => n >= 2).map(([k]) => k))
  })
  const stats = computed(() => ({
    total: all.value.length,
    open: all.value.filter((e) => !branchClosed(e)).length,
    cuisines: new Set(all.value.map((e) => e.cuisine)).size,
    chains: chainKeys.value.size,
    chainStores: all.value.filter((e) => chainKeys.value.has(brandKey(e))).length,
  }))
  const cuisineOptions = computed(() =>
    [...new Set(all.value.map((e) => e.cuisine))].sort((a, b) => a.localeCompare(b, 'zh'))
  )

  async function load(): Promise<void> {
    try {
      const data = await fetchRestaurants()
      all.value = Array.isArray(data) ? data : []
      error.value = null
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      loaded.value = true // 标记已尝试，触发错误边界
    }
  }

  async function retry(): Promise<void> {
    error.value = null
    loaded.value = false
    await load()
  }

  // 请求浏览器定位；成功后自动开启距离排序。拒绝/失败时静默（不改变状态）。
  async function locateMe(): Promise<void> {
    locating.value = true
    const ll = await requestPosition()
    if (ll) {
      userLocation.value = ll
      distanceSort.value = true
    }
    locating.value = false
  }

  function disableDistanceSort(): void {
    distanceSort.value = false
  }

  function setFilters(partial: Partial<{ query: string; cuisine: string; price: number; onlyOpen: boolean; mergeChains: boolean }>): void {
    if (partial.query !== undefined) query.value = partial.query
    if (partial.cuisine !== undefined) cuisine.value = partial.cuisine
    if (partial.price !== undefined) price.value = partial.price
    if (partial.onlyOpen !== undefined) onlyOpen.value = partial.onlyOpen
    if (partial.mergeChains !== undefined) mergeChains.value = partial.mergeChains
  }

  return {
    all, loaded, error, query, cuisine, price, onlyOpen, mergeChains,
    load, retry, setFilters, filtered, visible, stats, cuisineOptions,
    userLocation, distanceSort, locating, locateMe, disableDistanceSort,
  }
})
