<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/user'
import { getAdminProfile } from '@/api/auth'

const store = useAdminStore()

// Restore user profile on page refresh: token survives in localStorage,
// but userInfo is lost since it wasn't persisted. Fetch it eagerly so
// the sidebar and all pages have username/role immediately, avoiding
// null-dereference crashes in components that access userInfo.
onMounted(async () => {
  if (store.token) {
    try {
      const info = await getAdminProfile()
      if (info) store.setUserInfo(info)
    } catch (e: any) {
      // Only log out on genuine auth failures; transient network errors
      // should not destroy the user's session.
      if (e?.response?.status === 401 || e?.code === 40101 || e?.code === 40102) {
        store.logout()
      }
    }
  }
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>
