<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/user'
import { ElMessageBox } from 'element-plus'
import { Setting, DataAnalysis, Goods, Tickets, User, Document } from '@element-plus/icons-vue'

const appTitle = import.meta.env.VITE_APP_TITLE || 'H5靶机后台'
const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()

async function handleLogout() {
  try { await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' }) } catch { return }
  adminStore.logout(); router.replace('/login')
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside width="220px" class="admin-sidebar">
      <div class="sidebar-logo">
        <el-icon :size="22"><Setting /></el-icon>
        <span>{{ appTitle }}</span>
      </div>
      <el-menu :default-active="route.path" router :collapse="false" background-color="#304156" text-color="#bfcbd9" active-text-color="#ff6b35">
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/goods">
          <el-icon><Goods /></el-icon>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><Document /></el-icon>
          <span>日志管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <span>欢迎，{{ adminStore.username || '管理员' }}</span>
        <el-button link type="danger" @click="handleLogout">退出登录</el-button>
      </el-header>
      <el-main class="admin-main">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout{height:100vh}
.admin-sidebar{background:#304156;overflow-y:auto}
.sidebar-logo{display:flex;align-items:center;gap:8px;padding:20px 16px;color:#fff;font-size:17px;font-weight:600;border-bottom:1px solid rgba(255,255,255,.1)}
.admin-header{background:#fff;display:flex;align-items:center;justify-content:flex-end;gap:20px;border-bottom:1px solid #e8e8e8;font-size:13px;color:#666}
.admin-main{background:#f5f7fa;padding:20px;overflow-y:auto}
</style>
