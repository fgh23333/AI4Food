import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPosition, useGeolocation } from '@/composables/useGeolocation'

describe('requestPosition', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功返回坐标', async () => {
    const fake = {
      getCurrentPosition: (succ: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        succ({ coords: { latitude: 31.2, longitude: 121.4 } }),
    }
    vi.stubGlobal('navigator', { geolocation: fake })
    expect(await requestPosition()).toEqual({ lat: 31.2, lng: 121.4 })
  })

  it('不支持 geolocation 时返回 null', async () => {
    vi.stubGlobal('navigator', {})
    expect(await requestPosition()).toBeNull()
  })

  it('定位失败（权限拒绝等）返回 null，不抛错', async () => {
    const fake = {
      getCurrentPosition: (_succ: unknown, err: (e: { code: number }) => void) => err({ code: 1 }),
    }
    vi.stubGlobal('navigator', { geolocation: fake })
    expect(await requestPosition()).toBeNull()
  })
})

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('locate 成功后 location 更新、loading 复位', async () => {
    const fake = {
      getCurrentPosition: (succ: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        succ({ coords: { latitude: 30, longitude: 120 } }),
    }
    vi.stubGlobal('navigator', { geolocation: fake })
    const { location, loading, locate } = useGeolocation()
    expect(loading.value).toBe(false)
    const p = locate()
    expect(loading.value).toBe(true)
    await p
    expect(location.value).toEqual({ lat: 30, lng: 120 })
    expect(loading.value).toBe(false)
  })
})
