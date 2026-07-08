<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <div class="placeholder">详情页占位：{{ id }}</div>
</template>

<style scoped>
.placeholder { padding: 40px; }
</style>
