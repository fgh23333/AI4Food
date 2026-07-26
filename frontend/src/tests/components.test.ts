import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonCard from '@/components/SkeletonCard.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import EmptyState from '@/components/EmptyState.vue'
import MarkClosedButton from '@/components/MarkClosedButton.vue'
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
