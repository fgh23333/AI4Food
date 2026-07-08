<script setup lang="ts">
const props = defineProps<{ rating?: number }>()
function stars(r: number): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += i < Math.round(r) ? '★' : '·'
  return s
}
</script>

<template>
  <span v-if="props.rating" class="rating">
    <span class="stars">{{ stars(props.rating) }}</span>
    <span class="num">{{ props.rating.toFixed(1) }}</span>
  </span>
</template>

<style scoped>
.rating { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; }
.stars { letter-spacing: 1px; }
.num { font-size: 13px; }
</style>
