import request from './request'

export interface FeedbackItem {
  id: number; type: string; content: string; contact: string
  images: string[]; status: number; created_at: string
}

export function getFeedbackList(params?: { page?: number; page_size?: number; type?: string }) {
  return request.get<{ list: FeedbackItem[]; total: number; page: number; page_size: number }>('/msg/feedback/list', { params })
}

export function updateFeedbackStatus(id: number, status: number) {
  return request.put(`/msg/feedback/${id}/status`, { status })
}
