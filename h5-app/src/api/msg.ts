import request from './request'
import type { PageData } from './request'

export type MsgType = 'system' | 'order' | 'promotion'

export interface MessageItem {
  id: number
  title: string
  content: string
  msg_type: MsgType
  is_read: boolean
  related_order_no?: string
  created_at: string
}

export function getMsgList(params?: { page?: number; page_size?: number; msg_type?: MsgType }) {
  return request.get<PageData<MessageItem>>('/msg/notifications/', { params })
}

export function getUnreadCount() {
  return request.get<{ count: number }>('/msg/notifications/unread-count')
}

export function markAsRead(id: number) {
  return request.post<null>('/msg/notifications/read', { id })
}

export function markAllAsRead() {
  return request.put<null>('/msg/notifications/read-all')
}
