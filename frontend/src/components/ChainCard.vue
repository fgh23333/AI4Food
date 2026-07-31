<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChainBrand } from '@/types/restaurant'
import { branchClosed, averageRating } from '@/composables/useChains'
import RatingStars from './RatingStars.vue'
import BranchList from './BranchList.vue'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ brand: ChainBrand; hue: number; defaultOpen: boolean }>()
const bar = `hsl(${props.hue} 68% 50%)`
const open = ref(props.defaultOpen)
const openCount = computed(() => props.brand.branches.filter((b) => !branchClosed(b)).length)
const avg = computed(() => averageRating(props.brand.branches))
const levels = computed(() => props.brand.branches.map((b) => b.price_level).filter((x): x is number => typeof x === 'number'))
const priceText = computed(() => {
  if (levels.value.length === 0) return ''
  const lo = Math.min(...levels.value), hi = Math.max(...levels.value)
  return lo === hi ? `¥×${lo}` : `¥×${lo}–${hi}`
})
const mergedTags = computed(() => {
  const seen = new Set<string>(); const out: string[] = []
  for (const b of props.brand.branches) for (const t of b.tags ?? []) {
    if (t === '连锁' || t === '已关店' || seen.has(t)) continue
    seen.add(t); out.push(t)
  }
  return out.slice(0, 8)
})
const mergedRecs = computed(() => {
  const seen = new Set<string>(); const out: { name: string; note?: string }[] = []
  for (const b of props.brand.branches) for (const r of b.recommendations ?? []) {
    if (r.name && !seen.has(r.name)) { seen.add(r.name); out.push(r) }
  }
  return out.slice(0, 4)
})
// 连锁收藏：绑定代表店（首家）id，branches 由 toDisplayItems 保证非空
const primaryId = computed(() => props.brand.branches[0]?.id ?? '')
</script>

<template>
  <article class="card chain" :style="{ '--bar': bar }">
    <div class="head">
      <div class="brand-left">
        <span class="monogram" :style="{ background: `${bar}1f`, color: bar }">{{ brand.name.trim()[0] }}</span>
        <div>
          <h3 class="name">{{ brand.name }}</h3>
          <div class="sub">连锁品牌 · {{ brand.branches.length }} 家 · {{ openCount }} 营业<span v-if="avg"> · 均分 {{ avg.toFixed(1) }}</span></div>
        </div>
      </div>
      <div class="head-right">
        <RatingStars v-if="avg" :rating="Math.round(avg * 2) / 2" />
        <FavoriteButton :id="primaryId" />
      </div>
    </div>
    <div class="meta"><span class="cuisine">{{ brand.cuisine }}</span><span v-if="priceText" class="price">{{ priceText }}</span></div>
    <div v-if="mergedRecs.length" class="recs"><span v-for="(r, i) in mergedRecs" :key="i" class="rec">★ {{ r.name }}</span></div>
    <div v-if="mergedTags.length" class="tags"><span v-for="t in mergedTags" :key="t" class="tag">{{ t }}</span></div>
    <details :open="open">
      <summary @click.prevent="open = !open"><span>查看 {{ brand.branches.length }} 家分店</span><span class="chev">▾</span></summary>
      <BranchList :branches="brand.branches" :open="open" />
    </details>
  </article>
</template>

<style scoped>
.card { background: var(--card); border: 1px solid var(--line); border-top: 4px solid var(--bar); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; justify-content: space-between; gap: 10px; }
.head-right { display: flex; align-items: center; gap: 6px; }
.brand-left { display: flex; gap: 13px; align-items: center; }
.monogram { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; font-size: 21px; font-weight: 800; }
.name { font-size: 17px; font-weight: 750; margin: 0; }
.sub { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; }
.meta { display: flex; gap: 8px; align-items: center; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.price { color: var(--accent); font-weight: 700; }
.recs { display: flex; flex-wrap: wrap; gap: 6px; }
.rec { font-size: 11.5px; color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); padding: 4px 10px; border-radius: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
summary { list-style: none; cursor: pointer; padding: 9px 4px; font-size: 13px; font-weight: 600; color: var(--brand); display: flex; justify-content: space-between; }
summary::-webkit-details-marker { display: none; }
.chev { transition: transform .18s; }
details[open] .chev { transform: rotate(180deg); }
/* 溢出兜底：grid 子项允许收缩，防长文本撑爆（桌面渲染不变） */
.card { min-width: 0; }
/* 移动端：head/brand-left 允许换行、字号温和收缩（桌面 base 不动） */
@media (max-width: 768px) {
  .head { flex-wrap: wrap; }
  .brand-left { flex-wrap: wrap; gap: 10px; }
  .name { font-size: 16px; }
  .card { padding: 16px; gap: 10px; }
  .monogram { width: 40px; height: 40px; font-size: 19px; }
}
</style>
