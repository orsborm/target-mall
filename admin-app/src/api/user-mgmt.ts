import request from './request'

export interface UserItem {
  id: number; username: string; nickname: string
  phone: string; email: string; role_code: string; status: number; created_at: string
}

export function getUserList(params?: any) {
  return request.get<{ list: UserItem[]; total: number; page: number; page_size: number }>('/sys/user/list', { params })
}
export function updateUserStatus(id: number, status: number) {
  return request.put(`/sys/user/${id}/status`, { status })
}
