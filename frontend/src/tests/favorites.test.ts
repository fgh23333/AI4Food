import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoritesStore } from '@/stores/favorites'

describe('useFavoritesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('toggle 增加并移除收藏', () => {
    const s = useFavoritesStore()
    expect(s.has('a')).toBe(false)
    s.toggle('a')
    expect(s.has('a')).toBe(true)
    expect(s.count).toBe(1)
    s.toggle('a')
    expect(s.has('a')).toBe(false)
    expect(s.count).toBe(0)
  })

  it('clear 清空全部', () => {
    const s = useFavoritesStore()
    s.toggle('a')
    s.toggle('b')
    s.clear()
    expect(s.count).toBe(0)
    expect(s.has('a')).toBe(false)
  })

  it('toggle 持久化到 localStorage', () => {
    const s = useFavoritesStore()
    s.toggle('a')
    s.toggle('b')
    const raw = localStorage.getItem('ai4food:favorites')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(['a', 'b'])
  })

  it('store 初始化时从 localStorage 读回', () => {
    localStorage.setItem('ai4food:favorites', JSON.stringify(['x', 'y']))
    const s = useFavoritesStore()
    expect(s.has('x')).toBe(true)
    expect(s.count).toBe(2)
  })

  it('localStorage 损坏时优雅降级为空', () => {
    localStorage.setItem('ai4food:favorites', '{not json')
    const s = useFavoritesStore()
    expect(s.count).toBe(0)
  })
})
