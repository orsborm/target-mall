<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { getUserInfo } from '@/api/user'
import { getCartCount } from '@/api/cart'
import AppLayout from '@/components/AppLayout.vue'

const userStore = useUserStore()
const cartStore = useCartStore()

onMounted(async () => {
  if (userStore.token) {
    try {
      const [info, cart] = await Promise.all([
        getUserInfo(),
        getCartCount().catch(() => ({ count: 0 })),
      ])
      userStore.setUserInfo(info)
      cartStore.setCount(cart.count)
    } catch {
      userStore.logout()
    }
  }
})
</script>

<template>
  <AppLayout>
    <router-view v-slot="{ Component, route: r }">
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="r.fullPath" />
      </transition>
    </router-view>
  </AppLayout>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
