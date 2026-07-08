<script setup lang="ts">
import { onMounted } from 'vue'
import { useRestaurantsStore } from '@/stores/restaurants'

const store = useRestaurantsStore()
onMounted(() => store.load())
</script>

<template>
  <div class="placeholder">
    <p>已加载 {{ store.all.length }} 家；错误：{{ store.error ?? '无' }}</p>
  </div>
</template>

<style scoped>
.placeholder { padding: 40px; }
</style>
