<script setup lang="ts">
defineProps<{ total: number; pageSize: number; page: number }>()
const emit = defineEmits<{ (e: 'page-change', p: number): void }>()
</script>

<template>
  <div style="display:flex;justify-content:center;margin-top:16px" v-if="total > pageSize">
    <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="(p: number) => emit('page-change', p)" />
  </div>
</template>
