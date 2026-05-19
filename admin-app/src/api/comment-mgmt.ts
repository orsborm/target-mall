import request from './request'

export interface AdminComment {
  id: number; spu_id: number; user_id: number; username: string
  rating: number; content: string; images: string[]; created_at: string
}

export function getCommentList(params?: { spu_id?: number; page?: number; page_size?: number }) {
  return request.get<{ list: AdminComment[]; total: number; page: number; page_size: number }>('/goods/comment/list', { params })
}

export function deleteAdminComment(id: number) {
  return request.delete(`/goods/comment/${id}`)
}
