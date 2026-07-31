<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { useRestaurantsStore } from '@/stores/restaurants'
import RestaurantCard from '@/components/RestaurantCard.vue'

const favorites = useFavoritesStore()
const store = useRestaurantsStore()
const router = useRouter()
if (!store.loaded) store.load()

// 收藏的餐厅（按收藏顺序，store.all 里筛；未加载到的不显示）
const entries = computed(() => store.all.filter((e) => favorites.has(e.id)))

function hue(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h
}

// 选择困难症杀手：随机抽一家并跳详情
function rollRandom(): void {
  const list = entries.value
  if (!list.length) return
  const pick = list[Math.floor(Math.random() * list.length)]
  if (pick) router.push({ name: 'detail', params: { id: pick.id } })
}
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="brand"><span class="logo">❤️</span><div><h1>想吃清单</h1><p class="sub">收藏的餐厅，存在本地浏览器</p></div></div>
      <div v-if="entries.length" class="actions">
        <button class="ghost" @click="rollRandom">🎲 随机抽一家</button>
        <RouterLink to="/" class="ghost">← 返回列表</RouterLink>
      </div>
    </div>
  </header>
  <main class="wrap">
    <div v-if="!store.loaded" class="state">加载中…</div>
    <div v-else-if="!entries.length" class="state empty">
      <p>还没有收藏的餐厅。</p>
      <RouterLink to="/" class="link">去列表逛逛 →</RouterLink>
    </div>
    <div v-else class="grid">
      <RestaurantCard v-for="e in entries" :key="e.id" :entry="e" :hue="hue(e.cuisine)" />
    </div>
  </main>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #e5484d, #9c2230); color: #fff; padding: 46px 0 36px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 46px; height: 46px; border-radius: 13px; background: rgba(255,255,255,.16); display: grid; place-items: center; font-size: 24px; }
h1 { margin: 0; font-size: 30px; font-weight: 800; }
.sub { margin: 2px 0 0; font-size: 13.5px; opacity: .9; }
.actions { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
.ghost { background: rgba(255,255,255,.16); color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 11px; font-size: 14px; font-weight: 500; border: 0; cursor: pointer; }
.ghost:hover { background: rgba(255,255,255,.26); }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 336px), 1fr)); padding: 28px 0 64px; }
.grid > * { min-width: 0; }
.state { text-align: center; padding: 80px 20px; color: var(--ink-mute); }
.state.empty .link { display: inline-block; margin-top: 12px; color: var(--brand); text-decoration: none; font-weight: 600; }
@media (max-width: 768px) {
  h1 { font-size: 24px; }
  .grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
}
</style>
