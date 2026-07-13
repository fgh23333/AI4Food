export interface UrlFilters { q: string; cuisine: string; price: number; open: boolean; merge: boolean }

export function encodeFilters(f: UrlFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.cuisine) p.set('cuisine', f.cuisine)
  if (f.price) p.set('price', String(f.price))
  if (!f.open) p.set('open', '0')        // 默认 true，只记 false
  if (!f.merge) p.set('merge', '0')      // 默认 true，只记 false
  return p
}

export function decodeFilters(p: URLSearchParams): Partial<UrlFilters> {
  const out: Partial<UrlFilters> = {}
  const hasAny = p.toString() !== ''
  if (p.has('q')) out.q = p.get('q') ?? ''
  if (p.has('cuisine')) out.cuisine = p.get('cuisine') ?? ''
  if (p.has('price')) out.price = Number(p.get('price')) || 0
  if (p.has('open')) {
    out.open = p.get('open') !== '0'
  } else if (hasAny) {
    out.open = true
  }
  if (p.has('merge')) {
    out.merge = p.get('merge') !== '0'
  } else if (hasAny) {
    out.merge = true
  }
  return out
}
