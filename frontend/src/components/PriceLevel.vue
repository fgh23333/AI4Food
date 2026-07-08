<script setup lang="ts">
const props = defineProps<{ level?: number; max?: number }>()
</script>

<template>
  <span v-if="props.level" class="price">
    {{ '¥'.repeat(Math.min(props.level, props.max ?? 5)) }}<span class="off">{{ '¥'.repeat(Math.max(0, (props.max ?? 5) - props.level)) }}</span>
  </span>
</template>

<style scoped>
.price { color: var(--accent); font-weight: 700; letter-spacing: .5px; }
.off { color: var(--line-strong); font-weight: 600; }
</style>
