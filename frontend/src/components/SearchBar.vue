<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>

<template>
  <label class="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
    <input v-model="model" type="search" placeholder="搜索店名、菜系、地址、招牌菜、标签…" autocomplete="off" />
  </label>
</template>

<style scoped>
.search { flex: 1 1 280px; min-width: 200px; display: flex; align-items: center; gap: 9px; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; }
.search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.search svg { width: 17px; height: 17px; fill: var(--ink-mute); }
.search input { border: none; outline: none; background: transparent; width: 100%; font-size: 14.5px; color: var(--ink); }
</style>
