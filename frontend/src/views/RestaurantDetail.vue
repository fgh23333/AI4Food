<script setup lang="ts">
import { computed } from 'vue'
import { useRestaurantsStore } from '@/stores/restaurants'
import RatingStars from '@/components/RatingStars.vue'
import PriceLevel from '@/components/PriceLevel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import MarkClosedButton from '@/components/MarkClosedButton.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import DataCompleteness from '@/components/DataCompleteness.vue'
import { renderMarkdown } from '@/lib/markdown'
import { statusLabel } from '@/lib/status'
import { REPO } from '@/lib/repo'

const props = defineProps<{ id: string }>()
const store = useRestaurantsStore()
if (!store.loaded) store.load()

const entry = computed(() => store.all.find((e) => e.id === props.id))
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const dayLabel: Record<string, string> = { mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' }
</script>

<template>
  <main class="wrap detail">
    <router-link to="/" class="back">← 返回列表</router-link>
    <div v-if="!entry" class="state">
      <p>未找到该餐厅（id: {{ id }}）。</p>
      <router-link to="/">回列表</router-link>
    </div>
    <article v-else class="card">
      <div class="title-row">
        <h1>{{ entry.name }}</h1>
        <FavoriteButton :id="entry.id" />
      </div>
      <div class="meta">
        <RatingStars :rating="entry.rating" />
        <span class="cuisine">{{ entry.cuisine }}</span>
        <PriceLevel :level="entry.price_level" />
        <StatusBadge :status="entry.status" />
      </div>
      <p v-if="entry.address" class="row">📍 <a :href="`https://www.amap.com/search?query=${encodeURIComponent(entry.address)}`" target="_blank" rel="noopener">{{ entry.address }}</a></p>
      <p v-if="entry.phone" class="row">☎ <a :href="`tel:${entry.phone}`">{{ entry.phone }}</a></p>
      <section v-if="entry.opening_hours" class="hours">
        <h3>营业时间</h3>
        <ul>
          <li v-for="d in days" :key="d">{{ dayLabel[d] }}：{{ entry.opening_hours[d] ?? '—' }}</li>
        </ul>
      </section>
      <section v-if="entry.recommendations?.length" class="recs">
        <h3>招牌推荐</h3>
        <ul><li v-for="(r, i) in entry.recommendations" :key="i"><b>{{ r.name }}</b><span v-if="r.note"> — {{ r.note }}</span></li></ul>
      </section>
      <section v-if="entry.tags?.length" class="tags"><span v-for="t in entry.tags.filter(t => t !== '连锁')" :key="t" class="tag">{{ t }}</span></section>
      <section v-if="entry.description" class="desc">
        <h3>探店正文</h3>
        <div class="md" v-html="renderMarkdown(entry.description)"></div>
      </section>
      <p v-if="entry.notes" class="notes">{{ entry.notes }}</p>
      <p class="updated">更新于 {{ entry.updated_at ?? '—' }}</p>
      <a :href="`${REPO}/blob/main/${entry.path}`" target="_blank" rel="noopener" class="src">查看源文件 →</a>
      <DataCompleteness :entry="entry" />
      <MarkClosedButton :entry="entry" />
    </article>
  </main>
</template>

<style scoped>
.detail { padding: 24px 22px 64px; }
.back { color: var(--brand); text-decoration: none; font-size: 13px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); margin-top: 14px; }
h1 { margin: 0 0 12px; }
.title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.title-row h1 { margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.cuisine { background: var(--brand-soft); color: var(--brand-dark); padding: 3px 11px; border-radius: 999px; font-size: 12px; font-weight: 650; }
.row { margin: 6px 0; font-size: 14px; }
.row a { color: var(--brand); }
section { margin-top: 20px; }
h3 { font-size: 15px; margin: 0 0 8px; color: var(--ink-soft); }
ul { margin: 0; padding-left: 20px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 11px; color: var(--ink-mute); border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
.md { font-size: 14.5px; line-height: 1.8; }
.notes { margin-top: 20px; padding: 12px 14px; background: var(--bg); border-radius: 10px; font-size: 13px; color: var(--ink-soft); }
.updated { font-size: 11px; color: var(--ink-mute); }
.src { display: inline-block; margin-top: 16px; color: var(--brand); text-decoration: none; font-weight: 600; }
.state { text-align: center; padding: 60px 20px; color: var(--ink-mute); }
/* 移动端：padding 收紧、标题缩号、可点元素触达 ≥40px（桌面 base 不动） */
@media (max-width: 768px) {
  .detail { padding: 20px 16px 56px; }
  .card { padding: 20px; }
  h1 { font-size: 22px; }
  .back { display: inline-flex; align-items: center; min-height: 40px; }
  .row a { display: inline-flex; align-items: center; min-height: 40px; }
  .src { display: inline-flex; align-items: center; min-height: 40px; }
}
</style>
