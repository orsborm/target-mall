import request from './request'

export interface PageConfig {
  id: number; page_key: string; key: string
  type: string; value: string; label: string; link: string; sort_order: number
}

export function getBanners(pageKey = 'home') {
  return request.get<PageConfig[]>(`/sys/page-config/${pageKey}`)
}
export function createBanner(data: Omit<PageConfig, 'id'>) {
  return request.post<PageConfig>('/sys/page-config/', data)
}
export function updateBanner(id: number, data: Partial<PageConfig>) {
  return request.put(`/sys/page-config/${id}`, data)
}
export function deleteBanner(id: number) {
  return request.delete(`/sys/page-config/${id}`)
}
