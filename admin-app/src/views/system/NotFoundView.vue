<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column">
    <h1 style="font-size:72px;color:#dcdfe6;margin:0">404</h1>
    <p style="font-size:16px;color:#999;margin:16px 0">页面不存在或已被移除</p>
    <el-button type="primary" @click="router.replace('/')">返回仪表盘</el-button>
  </div>
</template>
