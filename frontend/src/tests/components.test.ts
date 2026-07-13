import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonCard from '@/components/SkeletonCard.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import EmptyState from '@/components/EmptyState.vue'

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
