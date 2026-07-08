import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'

export const useRestaurantsStore = defineStore('restaurants', () => {
  const all = ref<RestaurantEntry[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const query = ref('')
  const cuisine = ref('')
  const price = ref(0)
  const onlyOpen = ref(true)
  const mergeChains = ref(true)

  async function load(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}dist/index.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as RestaurantEntry[]
      all.value = Array.isArray(data) ? data : []
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      loaded.value = true
    }
  }

  return { all, loaded, error, query, cuisine, price, onlyOpen, mergeChains, load }
})
