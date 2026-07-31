import { ref } from 'vue'
import type { LatLng } from '@/lib/distance'

export type { LatLng }

// 底层：封装 getCurrentPosition 为 Promise。
// 不支持 geolocation / 用户拒绝 / 超时 → 一律 resolve(null)（优雅降级，不抛错）。
export function requestPosition(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  })
}

// 响应式封装（给需要 loading/位置态的组件用）。store 直接用 requestPosition。
export function useGeolocation() {
  const location = ref<LatLng | null>(null)
  const loading = ref(false)

  async function locate(): Promise<LatLng | null> {
    loading.value = true
    const ll = await requestPosition()
    if (ll) location.value = ll
    loading.value = false
    return ll
  }

  return { location, loading, locate }
}
