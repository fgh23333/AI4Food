<script setup lang="ts">
const props = defineProps<{ status?: string }>()
const label: Record<string, string> = { open: '营业中', closed: '已关闭', relocated: '已搬迁', demolished: '已拆除' }
</script>

<template>
  <span v-if="props.status && props.status !== 'open'" class="badge">{{ label[props.status] ?? props.status }}</span>
</template>

<style scoped>
.badge { background: #e8e0d4; color: #8a7a6a; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 650; }
@media (prefers-color-scheme: dark) { .badge { background: #3a322c; color: #9a8a7a; } }
</style>
