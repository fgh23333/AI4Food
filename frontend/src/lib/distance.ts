// 距离计算与排序：纯函数，无副作用，便于单测。

export interface LatLng {
  lat: number
  lng: number
}

export interface WithCoords {
  latitude?: number
  longitude?: number
}

// Haversine 公式：两点间球面大圆距离（km）。
// 地球半径取 6371km（WGS84 平均半径）。
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number): number => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// 按到 origin 的距离排序：有坐标的按距离升序在前，无坐标的稳定置底（km=undefined）。
export function sortByDistance<T extends WithCoords>(
  items: T[],
  origin: LatLng,
): Array<{ item: T; km?: number }> {
  const stamped = items.map((item): { item: T; km?: number } => {
    // 直接用 typeof 条件让 TS 收窄 latitude/longitude 为 number
    if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      return { item, km: haversineKm(origin.lat, origin.lng, item.latitude, item.longitude) }
    }
    return { item }
  })
  const hasCoord = stamped.filter((x) => x.km !== undefined)
  const noCoord = stamped.filter((x) => x.km === undefined)
  hasCoord.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
  return [...hasCoord, ...noCoord]
}

// 距离格式化：<1km 显示米，否则保留一位小数 km。
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}
