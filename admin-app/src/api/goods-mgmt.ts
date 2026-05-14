import request from './request'

export interface GoodsItem {
  id: number; spu_code: string; name: string; subtitle: string
  category_id: number; brand: string; main_image: string; images: string[]
  min_price: number; max_price: number; sales: number; status: number; created_at: string
}

export function getGoodsList(params?: any) {
  return request.get<{ list: GoodsItem[]; total: number; page: number; page_size: number }>('/goods/spu/list', { params })
}
export function updateGoodsStatus(id: number, status: number) {
  return request.put(`/goods/spu/${id}/status`, { status })
}
export function updateGoods(id: number, data: Partial<GoodsItem>) {
  return request.put(`/goods/spu/${id}`, data)
}
export function getDashboardOverview() {
  return request.get<{ total_goods: number; total_users: number; total_orders: number; today_orders: number; pending_orders: number; total_revenue: number }>('/sys/dashboard/overview')
}
