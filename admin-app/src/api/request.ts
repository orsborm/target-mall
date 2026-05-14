import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { deepFixEncoding } from '@/utils/encoding'
import { useAdminStore } from '@/stores/user'

interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
})

let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

async function tryRefreshToken(): Promise<string | null> {
  const store = useAdminStore()
  if (!store.refreshToken) return null
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_BASE}/user/auth/refresh-token`,
      { refresh_token: store.refreshToken },
    )
    if (res.data?.code === 0 && res.data?.data?.access_token) {
      return res.data.data.access_token
    }
    return null
  } catch {
    return null
  }
}

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const store = useAdminStore()
    if (store.token) {
      config.headers.Authorization = `Bearer ${store.token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data

    if (res.code === 0) {
      return deepFixEncoding(res.data)
    }

    if (res.code === 40101 || res.code === 40102) {
      const store = useAdminStore()
      store.logout()
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(new Error(res.msg))
    }

    ElMessage.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg))
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const store = useAdminStore()
      if (!store.refreshToken) {
        store.logout()
        router.push('/login')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(service(originalRequest))
          })
        })
      }

      isRefreshing = true
      originalRequest._retry = true

      const newToken = await tryRefreshToken()
      if (newToken) {
        store.setToken(newToken)
        onRefreshed(newToken)
        isRefreshing = false
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return service(originalRequest)
      }

      isRefreshing = false
      refreshSubscribers = []
      store.logout()
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(error)
    }

    if (error.response) {
      const status = error.response.status
      if (status === 422) {
        ElMessage.error('参数校验失败')
      } else if (status === 429) {
        ElMessage.error('请求过于频繁，请稍后再试')
      } else if (status >= 500) {
        ElMessage.error('服务器异常')
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请重试')
    } else {
      ElMessage.error('网络连接失败，请检查后端服务')
    }
    return Promise.reject(error)
  },
)

export default service
export type { ApiResponse }
