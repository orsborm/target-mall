import request from './request'
import axios from 'axios'

export function refreshToken(refreshToken: string): Promise<string | null> {
  return axios.post(
    `${import.meta.env.VITE_API_BASE}/user/auth/refresh-token`,
    { refresh_token: refreshToken },
  ).then(res => {
    if (res.data?.code === 0 && res.data?.data?.access_token) {
      return res.data.data.access_token as string
    }
    return null
  }).catch((e) => { if (import.meta.env.DEV) console.error('Token refresh failed:', e instanceof Error ? e.message : e); return null })
}

export interface LoginParams {
  username: string
  password: string
  captcha_code: string
  captcha_id: string
}

export interface LoginResult {
  access_token: string
  refresh_token: string
  expires_in: number
  user_info: UserInfo
}

export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
  phone: string
  email: string
  role_code: string
  status: number
  created_at: string
}

export interface RegisterParams {
  username: string
  password: string
  confirm_password: string
  phone: string
  captcha_code: string
  captcha_id: string
}

export interface UpdateProfileParams {
  nickname?: string
  avatar?: string
  phone?: string
  email?: string
}

export interface Address {
  id: number
  user_id: number
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  is_default: boolean
  created_at: string
}

export interface AddressParams {
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  is_default?: boolean
}

export function login(data: LoginParams) {
  return request.post<LoginResult>('/user/auth/login', data)
}

export function register(data: RegisterParams) {
  return request.post<null>('/user/auth/register', data)
}

export function getUserInfo() {
  return request.get<UserInfo>('/user/profile/')
}

export function updateProfile(data: UpdateProfileParams) {
  return request.put<null>('/user/profile/', data)
}

export function changePassword(data: { old_password: string; new_password: string }) {
  return request.put<null>('/user/profile/password', data)
}

export function getAddressList() {
  return request.get<Address[]>('/user/address/')
}

export function createAddress(data: AddressParams) {
  return request.post<{ id: number }>('/user/address/', data)
}

export function updateAddress(id: number, data: AddressParams) {
  return request.put<null>(`/user/address/${id}`, data)
}

export function deleteAddress(id: number) {
  return request.delete<null>(`/user/address/${id}`)
}

export function logout() {
  return request.post<null>('/user/profile/logout')
}
