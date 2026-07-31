<script setup lang="ts">
import { computed } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'
import RatingStars from './RatingStars.vue'
import PriceLevel from './PriceLevel.vue'
import StatusBadge from './StatusBadge.vue'
import FavoriteButton from './FavoriteButton.vue'
import { haversineKm, formatDistance } from '@/lib/distance'
import type { LatLng } from '@/lib/distance'
import { REPO } from '@/lib/repo'

const props = defineProps<{ entry: RestaurantEntry; hue: number; origin?: LatLng | null; distanceActive?: boolean }>()
const bar = `hsl(${props.hue} 68% 50%)`

// 距离文案：开启距离排序且有定位时，有坐标算距离，无坐标标"缺坐标"
const distanceText = computed<string | null>(() => {
  if (!props.distanceActive || !props.origin) return null
  if (typeof props.entry.latitude === 'number' && typeof props.entry.longitude === 'number') {
    const km = haversineKm(props.origin.lat, props.origin.lng, props.entry.latitude, props.entry.longitude)
    return `距你 ${formatDistance(km)}`
  }
  return '缺坐标'
})
</script>

<template>
  <article class="card" :style="{ '--bar': bar }">
    <div class="head">
      <h3 class="name">{{ entry.name }}</h3>
      <div class="head-right">
        <RatingStars :rating="entry.rating" />
        <FavoriteButton :id="entry.id" />
      </div>
    </div>
    <div class="meta">
      <span class="cuisine">{{ entry.cuisine }}</span>
      <PriceLevel :level="entry.price_level" />
      <StatusBadge :status="entry.status" />
    </div>
    <p v-if="entry.address" class="addr">📍 {{ entry.address }}<span v-if="distanceText" class="dist"> · {{ distanceText }}</span></p>
    <p v-else-if="distanceText" class="addr">📍 {{ distanceText }}</p>
    <div v-if="entry.recommendations?.length" class="recs">
      <span v-for="(r, i) in entry.recommendations.slice(0, 4)" :key="i" class="rec">★ {{ r.name }}</span>
    </div>
    <div v-if="entry.tags?.length" class="tags">
      <span v-for="t in entry.tags.filter(t => t !== '连锁').slice(0, 8)" :key="t" class="tag">{{ t }}</span>
    </div>
    <div class="foot">
      <span v-if="entry.notes" class="note">{{ entry.notes }}</span>
      <a :href="`${REPO}/blob/main/${entry.path}`" target="_blank" rel="noopener" class="src">查看源文件 →</a>
    </div>
  </article>
</template>

<style scoped>
.card { background: var(--card); border: 1px solid var(--line); border-top: 3px solid var(--bar); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 12px; transition: transform .16s, box-shadow .16s; }
.card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.head { display: flex; justify-content: space-between; gap: 10px; }
.head-right { display: flex; align-items: center; gap: 6px; }
.name { font-size: 17px; font-weight: 750; margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.addr { font-size: 12.5px; color: var(--ink-soft); margin: 0; }
.dist { color: var(--accent); font-weight: 600; }
.recs { display: flex; flex-wrap: wrap; gap: 6px; }
.rec { font-size: 11.5px; color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); padding: 4px 10px; border-radius: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
.foot { margin-top: auto; padding-top: 11px; border-top: 1px dashed var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.note { font-size: 11px; color: var(--ink-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.src { font-size: 12px; color: var(--brand); text-decoration: none; font-weight: 600; }
.src:hover { text-decoration: underline; }
/* 溢出兜底：grid/flex 子项允许收缩到 min-content 以下，防长文本撑爆轨道（桌面渲染不变） */
.card { min-width: 0; }
.note { min-width: 0; }
/* 移动端：head 允许换行、字号/留白温和收缩（桌面 base 不动） */
@media (max-width: 768px) {
  .head { flex-wrap: wrap; }
  .name { font-size: 16px; }
  .card { padding: 16px; gap: 10px; }
}
</style>
