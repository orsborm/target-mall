import request from './request'
import axios from 'axios'
import type { AdminUserInfo } from '@/stores/user'

export interface LoginResult {
  access_token: string
  refresh_token: string
  expires_in: number
  user_info: AdminUserInfo
}

export function adminLogin(data: { username: string; password: string; captcha_code: string; captcha_id: string }) {
  return request.post<LoginResult>('/user/auth/login', data)
}

export function adminLogout() {
  return request.post<null>('/user/profile/logout')
}

export function getCaptcha() {
  return request.get<{ captcha_id: string; captcha_image: string }>('/sys/common/captcha')
}

export function getAdminProfile() {
  // Used by App.vue on mount to restore userInfo after a page refresh.
  return request.get<AdminUserInfo>('/user/profile/')
}

export async function refreshAdminToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_BASE}/user/auth/refresh-token`,
      { refresh_token: refreshToken },
      // Without a timeout, a hung refresh endpoint blocks ALL subsequent
      // 401-retry requests queued in refreshSubscribers forever.
      { timeout: 10000 },
    )
    if (res.data?.code === 0 && res.data?.data?.access_token) {
      return res.data.data.access_token
    }
    return null
  } catch (e) { if (import.meta.env.DEV) console.error('Admin token refresh failed:', e instanceof Error ? e.message : e); return null }
}
