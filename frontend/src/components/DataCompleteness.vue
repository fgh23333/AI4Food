<script setup lang="ts">
import { computed } from 'vue'
import type { RestaurantEntry } from '@/types/restaurant'
import { missingFields } from '@/lib/enrichDraft'
import EnrichButton from './EnrichButton.vue'

const props = defineProps<{ entry: RestaurantEntry }>()
const gaps = computed(() => missingFields(props.entry))
</script>

<template>
  <section v-if="gaps.length" class="completeness">
    <div class="ch-head">
      <span class="ch-title">📋 数据待完善</span>
      <span class="gaps">
        <span v-for="g in gaps" :key="g.key" class="gap">缺{{ g.label }}</span>
      </span>
    </div>
    <p class="ch-hint">去过这家店？帮忙补全以上信息，众人拾柴火焰高。</p>
    <EnrichButton :entry="entry" />
  </section>
</template>

<style scoped>
.completeness { margin-top: 20px; padding: 14px 16px; background: var(--accent-soft); border: 1px solid var(--line); border-radius: 12px; }
.ch-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ch-title { font-size: 14px; font-weight: 700; color: var(--ink); }
.gaps { display: flex; gap: 6px; flex-wrap: wrap; }
.gap { font-size: 11px; color: var(--brand-dark); background: rgba(255,255,255,.6); border: 1px solid var(--brand); padding: 2px 8px; border-radius: 6px; }
.ch-hint { margin: 8px 0 12px; font-size: 12.5px; color: var(--ink-soft); line-height: 1.5; }
@media (max-width: 768px) { .ch-head { gap: 8px; } }
</style>
