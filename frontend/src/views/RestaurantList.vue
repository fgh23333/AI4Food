<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useRestaurantsStore } from '@/stores/restaurants'
import { encodeFilters, decodeFilters } from '@/composables/useUrlSync'
import FilterBar from '@/components/FilterBar.vue'
import RestaurantCard from '@/components/RestaurantCard.vue'
import ChainCard from '@/components/ChainCard.vue'
import StatBar from '@/components/StatBar.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useRestaurantsStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') params.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => { if (typeof v === 'string') params.append(key, v) })
  }
  const fromUrl = decodeFilters(params)
  // UrlFilters 字段名与 store 字段名不同（q↔query、open↔onlyOpen、merge↔mergeChains），
  // 必须显式映射，不能整对象赋值（否则 q/open/merge 三个键对不上 store，URL 回填静默失效）。
  store.setFilters({
    ...(fromUrl.q !== undefined && { query: fromUrl.q }),
    ...(fromUrl.cuisine !== undefined && { cuisine: fromUrl.cuisine }),
    ...(fromUrl.price !== undefined && { price: fromUrl.price }),
    ...(fromUrl.open !== undefined && { onlyOpen: fromUrl.open }),
    ...(fromUrl.merge !== undefined && { mergeChains: fromUrl.merge }),
  })
  if (!store.loaded) store.load()
})

watch(
  () => [store.query, store.cuisine, store.price, store.onlyOpen, store.mergeChains] as const,
  () => {
    const encoded = encodeFilters({ q: store.query, cuisine: store.cuisine, price: store.price, open: store.onlyOpen, merge: store.mergeChains })
    router.replace({ query: Object.fromEntries(encoded) })
  },
)

function hue(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h
}

function resetFilters() {
  store.query = ''
  store.cuisine = ''
  store.price = 0
}
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="brand"><span class="logo">🍽️</span><div><h1>AI4Food</h1><p class="sub">社区共建的上海餐厅数据图鉴</p></div></div>
      <StatBar v-bind="store.stats" />
      <RouterLink to="/ask" class="ai-entry">🤖 问问 AI：用自然语言找餐厅</RouterLink>
    </div>
  </header>
  <main class="wrap toolbar"><FilterBar v-model:query="store.query" v-model:cuisine="store.cuisine" v-model:price="store.price" v-model:onlyOpen="store.onlyOpen" v-model:mergeChains="store.mergeChains" :cuisine-options="store.cuisineOptions" :result-count="`显示 ${store.filtered.length} / ${store.all.length} 家`" /></main>
  <main class="wrap">
    <ErrorBoundary v-if="store.error" :message="`数据加载失败：${store.error}`" @retry="store.retry" />
    <div v-else-if="!store.loaded" class="grid">
      <SkeletonCard v-for="n in 8" :key="n" />
    </div>
    <EmptyState v-else-if="!store.visible.length" @reset="resetFilters" />
    <div v-else class="grid">
      <template v-for="(item, i) in store.visible" :key="i">
        <RestaurantCard v-if="item.type === 'single'" :entry="item.entry" :hue="hue(item.entry.cuisine)" />
        <ChainCard v-else :brand="item.brand" :hue="hue(item.brand.cuisine)" :default-open="!!store.query || !!store.cuisine || !!store.price" />
      </template>
    </div>
  </main>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #d35a40, #9c3522); color: #fff; padding: 46px 0 64px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 46px; height: 46px; border-radius: 13px; background: rgba(255,255,255,.16); display: grid; place-items: center; font-size: 24px; }
h1 { margin: 0; font-size: 30px; font-weight: 800; }
.sub { margin: 2px 0 0; font-size: 13.5px; opacity: .9; }
.hero :deep(.stats) { margin-top: 26px; }
.ai-entry { display: inline-block; margin-top: 18px; background: rgba(255,255,255,.16); color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 11px; font-size: 14px; font-weight: 500; transition: background .15s; }
.ai-entry:hover { background: rgba(255,255,255,.26); }
.toolbar { margin-top: -34px; position: relative; z-index: 5; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 336px), 1fr)); padding-bottom: 64px; }
.grid > * { min-width: 0; }
.state { text-align: center; padding: 80px 20px; color: var(--ink-mute); }
/* 平板：标题/留白随宽度平滑收缩（clamp 上界=桌面值，1024 处连续；桌面 base 不动） */
@media (max-width: 1024px) {
  .hero { padding: clamp(32px, 4.5vw, 46px) 0 clamp(44px, 6.25vw, 64px); }
  h1 { font-size: clamp(24px, 2.9vw, 30px); }
  .sub { font-size: clamp(12.5px, 1.3vw, 13.5px); }
  .hero :deep(.stats) { margin-top: clamp(18px, 2.5vw, 26px); }
}
/* 移动端：栅格转单列、工具条上移量收紧、AI 入口加大触达 */
@media (max-width: 768px) {
  .toolbar { margin-top: -24px; }
  .grid { grid-template-columns: minmax(0, 1fr); gap: 12px; padding-bottom: 48px; }
  .ai-entry { padding: 11px 16px; }
}
</style>
