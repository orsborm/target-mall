import request from './request'
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

export function getCaptcha() {
  return request.get<{ captcha_id: string; captcha_image: string }>('/sys/common/captcha')
}
