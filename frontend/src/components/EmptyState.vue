<script setup lang="ts">
const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="state">
    <p class="msg">没有匹配的餐厅</p>
    <button type="button" class="btn" @click="emit('reset')">重置筛选</button>
  </div>
</template>

<style scoped>
.state {
  text-align: center;
  padding: 80px 20px;
  color: var(--ink-mute);
}
.msg {
  margin: 0 0 18px;
  font-size: 15px;
}
.btn {
  display: inline-block;
  padding: 9px 22px;
  border-radius: 11px;
  border: 1px solid var(--line-strong);
  background: var(--card);
  color: var(--ink-soft);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn:hover {
  background: var(--bg);
  border-color: var(--ink-mute);
}
</style>
