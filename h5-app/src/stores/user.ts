import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/api/user'
import { getItem, setItem, removeItem } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getItem('access_token') || '')
  const refreshToken = ref<string>(getItem('refresh_token') || '')
  const userInfo = ref<UserInfo | null>(null)

  // Restore userInfo from localStorage on init
  try {
    const saved = getItem('user_info')
    if (saved) userInfo.value = JSON.parse(saved)
  } catch { /* ignore corrupt data */ }

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(accessToken: string, refresh_token: string, info: UserInfo) {
    token.value = accessToken
    refreshToken.value = refresh_token
    userInfo.value = info
    setItem('access_token', accessToken)
    setItem('refresh_token', refresh_token)
    setItem('user_info', JSON.stringify(info))
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    setItem('user_info', JSON.stringify(info))
  }

  function setToken(tk: string) {
    token.value = tk
    setItem('access_token', tk)
  }

  function logout() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    removeItem('access_token')
    removeItem('refresh_token')
    removeItem('user_info')
  }

  return { token, refreshToken, userInfo, isLoggedIn, setAuth, setUserInfo, setToken, logout }
})
