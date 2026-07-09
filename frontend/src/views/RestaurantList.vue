<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useRestaurantsStore } from '@/stores/restaurants'
import FilterBar from '@/components/FilterBar.vue'
import RestaurantCard from '@/components/RestaurantCard.vue'
import ChainCard from '@/components/ChainCard.vue'
import StatBar from '@/components/StatBar.vue'

const store = useRestaurantsStore()
onMounted(() => { if (!store.loaded) store.load() })
function hue(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h
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
    <div v-if="store.error" class="state">⚠️ 数据加载失败：{{ store.error }}</div>
    <div v-else-if="!store.loaded" class="state">加载中…</div>
    <div v-else-if="!store.visible.length" class="state">没有匹配的餐厅，试试调整筛选。</div>
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
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(336px, 1fr)); padding-bottom: 64px; }
.state { text-align: center; padding: 80px 20px; color: var(--ink-mute); }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
</style>
