import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SkeletonCard from '@/components/SkeletonCard.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import EmptyState from '@/components/EmptyState.vue'
import MarkClosedButton from '@/components/MarkClosedButton.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import DataCompleteness from '@/components/DataCompleteness.vue'
import EnrichButton from '@/components/EnrichButton.vue'
import { useFavoritesStore } from '@/stores/favorites'
import type { RestaurantEntry } from '@/types/restaurant'

describe('SkeletonCard', () => {
  it('渲染占位结构', () => {
    const w = mount(SkeletonCard)
    expect(w.classes()).toContain('skeleton-card')
  })
})

describe('ErrorBoundary', () => {
  it('显示错误消息与重试按钮', async () => {
    const w = mount(ErrorBoundary, { props: { message: '加载失败' } })
    expect(w.text()).toContain('加载失败')
    expect(w.find('button').exists()).toBe(true)
    await w.find('button').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })
})

describe('EmptyState', () => {
  it('点击重置触发 reset 事件', async () => {
    const w = mount(EmptyState)
    await w.find('button').trigger('click')
    expect(w.emitted('reset')).toBeTruthy()
  })
})

describe('MarkClosedButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('点击后打开 GitHub 编辑 URL 并预填关闭草稿', async () => {
    const entry = {
      id: 'cn-shanghai-test',
      name: '测试店',
      city: '上海',
      country: 'cn',
      cuisine: '中餐',
      price_level: 2,
      status: 'open',
      path: 'data/restaurants/cn/shanghai/test.md',
    } as RestaurantEntry
    const openSpy = vi.spyOn(window, 'open').mockImplementation(vi.fn())

    const w = mount(MarkClosedButton, { props: { entry } })
    await w.find('button').trigger('click')

    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0]![0] as string
    const prefix = 'https://github.com/fgh23333/AI4Food/edit/main/data/restaurants/cn/shanghai/test.md?value='
    expect(url.startsWith(prefix)).toBe(true)

    const value = decodeURIComponent(url.slice(prefix.length))
    expect(value).toContain('status: closed')
    expect(value).toContain('# 测试店（已关闭）')

    openSpy.mockRestore()
  })
})

describe('FavoriteButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('点击切换收藏状态与文案', async () => {
    const w = mount(FavoriteButton, { props: { id: 'cn-test' } })
    expect(w.text()).toContain('🤍')
    expect(w.find('button').classes()).not.toContain('active')

    await w.find('button').trigger('click')
    expect(useFavoritesStore().has('cn-test')).toBe(true)
    expect(w.text()).toContain('❤️')
    expect(w.find('button').classes()).toContain('active')

    await w.find('button').trigger('click')
    expect(useFavoritesStore().has('cn-test')).toBe(false)
    expect(w.text()).toContain('🤍')
  })

  it('点击 stopPropagation 阻止冒泡到父元素', async () => {
    const onParentClick = vi.fn()
    const wrapper = mount(
      {
        template: '<div @click="onParentClick"><FavoriteButton id="x" /></div>',
        components: { FavoriteButton },
        setup() {
          return { onParentClick }
        },
      },
    )
    await wrapper.find('button').trigger('click')
    expect(onParentClick).not.toHaveBeenCalled()
  })
})

describe('DataCompleteness', () => {
  const full = {
    id: 'cn-shanghai-test', name: '测试店', city: '上海', country: 'cn',
    cuisine: '本帮菜', price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/test.md',
    address: '某路', latitude: 31, longitude: 121, phone: '021-1', opening_hours: { mon: '10-22' },
  } as RestaurantEntry

  it('有缺失字段时渲染徽标与补全按钮', () => {
    const w = mount(DataCompleteness, { props: { entry: { ...full, phone: undefined } } })
    expect(w.text()).toContain('缺电话')
    expect(w.find('button').exists()).toBe(true)
  })

  it('字段齐全时不渲染', () => {
    const w = mount(DataCompleteness, { props: { entry: full } })
    expect(w.find('section').exists()).toBe(false)
  })
})

describe('EnrichButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('点击打开 GitHub edit URL（不预填 value，避免覆盖原文）', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(vi.fn())
    const entry = {
      id: 'x', name: 'A', city: '上海', country: 'cn', cuisine: '本帮菜',
      price_level: 2, status: 'open', path: 'data/restaurants/cn/shanghai/x.md',
    } as RestaurantEntry
    const w = mount(EnrichButton, { props: { entry } })
    await w.find('button').trigger('click')
    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0]![0] as string
    expect(url).toBe('https://github.com/fgh23333/AI4Food/edit/main/data/restaurants/cn/shanghai/x.md')
    expect(url).not.toContain('?value=')
    openSpy.mockRestore()
  })
})
