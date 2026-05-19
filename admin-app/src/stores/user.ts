import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem, removeItem } from '@/utils/storage'

export interface AdminUserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
  role_code: string
  status: number
}

export const useAdminStore = defineStore('admin', () => {
  const token = ref<string>(getItem('admin_token') || '')
  const refreshToken = ref<string>(getItem('admin_refresh_token') || '')
  const userInfo = ref<AdminUserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const roleCode = computed(() => userInfo.value?.role_code || '')

  function setAuth(accessToken: string, refresh_token: string, info: AdminUserInfo) {
    token.value = accessToken
    refreshToken.value = refresh_token
    userInfo.value = info
    setItem('admin_token', accessToken)
    setItem('admin_refresh_token', refresh_token)
  }

  function setToken(tk: string) {
    token.value = tk
    setItem('admin_token', tk)
  }

  function logout() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    removeItem('admin_token')
    removeItem('admin_refresh_token')
  }

  return { token, refreshToken, userInfo, isLoggedIn, username, roleCode, setAuth, setToken, logout }
})
