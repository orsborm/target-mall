<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <el-button type="primary" @click="router.replace('/')">返回首页</el-button>
  </div>
</template>

<style scoped>
.not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; }
.not-found h1 { font-size: 72px; color: #dcdfe6; margin: 0; }
.not-found p { font-size: 16px; color: #909399; }
</style>
