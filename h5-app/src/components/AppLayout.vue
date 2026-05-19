<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { getCartCount } from '@/api/cart'
import { ElMessageBox } from 'element-plus'
import { useLogout } from '@/composables/useLogout'
import { Search, ShoppingCartFull, ShoppingCart } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const cartStore = useCartStore()

const appTitle = import.meta.env.VITE_APP_TITLE || 'H5靶机商城'
const searchKeyword = ref('')
const cartCount = ref(0)

const isLoggedIn = computed(() => userStore.isLoggedIn)
const userInfo = computed(() => userStore.userInfo)
const activeNav = computed(() => {
  if (route.path.startsWith('/goods')) return 'goods'
  // Exact match on /user/coupons BEFORE the /user prefix check,
  // otherwise the "/user" branch wins and "领券中心" never highlights.
  if (route.path === '/user/coupons') return 'coupon'
  if (route.path.startsWith('/order')) return 'order'
  if (route.path.startsWith('/cart')) return 'cart'
  if (route.path.startsWith('/user')) return 'user'
  if (route.path.startsWith('/feedback')) return 'feedback'
  return 'home'
})

watch(() => userStore.isLoggedIn, async (v) => {
  if (v) {
    try { const r = await getCartCount(); cartCount.value = r.count; cartStore.setCount(r.count) } catch { cartCount.value = 0 }
  } else { cartCount.value = 0 }
}, { immediate: true })

watch(() => cartStore.count, (v) => { cartCount.value = v })

function onSearch() {
  if (searchKeyword.value.trim()) {
    router.push({ name: 'goods-list', query: { keyword: searchKeyword.value.trim() } })
  }
}

const { handleLogout } = useLogout()
</script>

<template>
  <div class="app-layout">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="top-bar__inner">
        <span class="top-bar__welcome" v-if="isLoggedIn">欢迎，{{ userInfo?.nickname || userInfo?.username }}</span>
        <span class="top-bar__welcome" v-else>欢迎来到 {{ appTitle }}</span>
        <div class="top-bar__links">
          <template v-if="!isLoggedIn">
            <router-link to="/login">登录</router-link>
            <router-link to="/register">注册</router-link>
          </template>
          <template v-else>
            <router-link to="/order/list">我的订单</router-link>
            <router-link to="/user/profile">个人中心</router-link>
            <a href="javascript:;" @click="handleLogout">退出</a>
          </template>
        </div>
      </div>
    </div>

    <!-- Header -->
    <div class="app-header">
      <div class="app-header__inner">
        <router-link to="/" class="header-logo">
          <el-icon :size="24"><ShoppingCartFull /></el-icon>
          <span>{{ appTitle }}</span>
        </router-link>

        <div class="header-search">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索商品..."
            :prefix-icon="Search"
            clearable
            @keyup.enter="onSearch"
            size="large"
          />
        </div>

        <div class="header-cart" @click="$router.push('/cart')">
          <el-badge :value="cartCount" :hidden="cartCount <= 0" :max="99">
            <el-icon :size="26"><ShoppingCart /></el-icon>
          </el-badge>
          <span>购物车</span>
        </div>
      </div>
    </div>

    <!-- Nav -->
    <div class="app-nav">
      <div class="app-nav__inner">
        <router-link to="/" class="nav-item" :class="{ active: activeNav === 'home' }">首页</router-link>
        <router-link to="/goods/list" class="nav-item" :class="{ active: activeNav === 'goods' }">全部商品</router-link>
        <router-link to="/user/coupons" class="nav-item" :class="{ active: activeNav === 'coupon' }">领券中心</router-link>
        <router-link to="/cart" class="nav-item" :class="{ active: activeNav === 'cart' }">购物车</router-link>
        <router-link to="/order/list" class="nav-item" :class="{ active: activeNav === 'order' }">我的订单</router-link>
        <router-link to="/feedback" class="nav-item" :class="{ active: activeNav === 'feedback' }">意见反馈</router-link>
      </div>
    </div>

    <!-- Main Content -->
    <div class="app-main">
      <slot />
    </div>

    <!-- Footer -->
    <div class="app-footer">
      <div class="app-footer__inner">
        <div class="footer-col">
          <h4>{{ appTitle }}</h4>
          <p>安全练习 | 自动化练手 | 不断进化</p>
        </div>
        <div class="footer-col">
          <h4>快速链接</h4>
          <router-link to="/goods/list">商品列表</router-link>
          <router-link to="/cart">购物车</router-link>
          <router-link to="/order/list">我的订单</router-link>
        </div>
        <div class="footer-col">
          <h4>帮助中心</h4>
          <router-link to="/feedback">意见反馈</router-link>
          <router-link to="/system/logs">日志管理</router-link>
          <router-link to="/user/profile">个人中心</router-link>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 {{ appTitle }} - 仅供学习与自动化测试使用</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* Top Bar */
.top-bar {
  background: #f5f5f5;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
  color: #909399;
}
.top-bar__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  padding: 4px 16px;
}
.top-bar__links {
  display: flex;
  gap: 16px;
}
.top-bar__links a {
  color: #909399;
}
.top-bar__links a:hover {
  color: #ff6b35;
}

/* Header */
.app-header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  padding: 12px 0;
}
.app-header__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 24px;
}
.header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 700;
  color: #ff6b35;
  white-space: nowrap;
}
.header-search {
  flex: 1;
  max-width: 480px;
}
.header-cart {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  padding: 8px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 20px;
  transition: all 0.2s;
}
.header-cart:hover {
  border-color: #ff6b35;
  color: #ff6b35;
}

/* Nav */
.app-nav {
  background: #ff6b35;
}
.app-nav__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  padding: 0 16px;
}
.nav-item {
  display: block;
  padding: 12px 24px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}
.nav-item:hover,
.nav-item.active {
  color: #fff;
  background: rgba(0, 0, 0, 0.1);
}

/* Main */
.app-main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 16px;
}

/* Footer */
.app-footer {
  background: #303133;
  color: #c0c4cc;
  margin-top: 40px;
}
.app-footer__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  padding: 32px 16px;
  gap: 60px;
}
.footer-col h4 {
  color: #fff;
  margin-bottom: 12px;
  font-size: 15px;
}
.footer-col p {
  font-size: 13px;
  line-height: 1.8;
}
.footer-col a {
  display: block;
  color: #909399;
  font-size: 13px;
  margin-bottom: 8px;
}
.footer-col a:hover {
  color: #ff6b35;
}
.footer-bottom {
  border-top: 1px solid #4a4a4a;
  text-align: center;
  padding: 14px;
  font-size: 12px;
  color: #909399;
}
</style>
