import request from './request'

export interface UserItem {
  id: number; username: string; nickname: string
  phone: string; email: string; role_code: string; status: number; created_at: string
}

export interface UserListParams {
  page?: number
  page_size?: number
  keyword?: string
  role_code?: string
  status?: number
}

export function getUserList(params?: UserListParams) {
  return request.get<{ list: UserItem[]; total: number; page: number; page_size: number }>('/user/list', { params })
}
export function updateUserStatus(id: number, status: number) {
  return request.put(`/user/${id}/status`, { status })
}
