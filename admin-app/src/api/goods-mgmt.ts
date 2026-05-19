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
export interface SkuInfo {
  id: number; sku_code: string; price: number; stock: number
  main_image: string; specs: Record<string,string>
}
export interface GoodsDetail {
  spu: GoodsItem
  skus: SkuInfo[]
  specs: { name: string; values: { value: string }[] }[]
}
export function getGoodsDetail(spuId: number) {
  return request.get<GoodsDetail>(`/goods/spu/${spuId}`)
}
export function updateSkus(spuId: number, skus: { id: number; main_image?: string }[]) {
  return request.put(`/goods/spu/${spuId}/skus`, { skus })
}
export interface CreateGoodsBody {
  spu_code: string; name: string; subtitle: string
  category_id: number; brand: string; main_image: string; images: string[]
  min_price: number; max_price: number; sales: number; status: number
  skus?: { sku_code: string; price: number; stock: number; main_image: string; specs: Record<string,string> }[]
}
export function createGoods(data: CreateGoodsBody) {
  return request.post<{ id: number; msg: string }>('/goods/spu', data)
}
export function deleteGoods(id: number) {
  return request.delete(`/goods/spu/${id}`)
}

export interface GoodsCategory {
  id: number; name: string; icon: string
  parent_id: number; level: number; sort_order: number
  children?: GoodsCategory[]
}
export function getCategoryTree() {
  return request.get<GoodsCategory[]>('/goods/category/tree')
}
export function createCategory(data: { name: string; icon?: string; parent_id: number; level: number; sort_order?: number }) {
  return request.post<GoodsCategory>('/goods/category/', data)
}
export function updateCategory(id: number, data: { name?: string; icon?: string; sort_order?: number }) {
  return request.put(`/goods/category/${id}`, data)
}
export function deleteCategory(id: number) {
  return request.delete(`/goods/category/${id}`)
}

export interface DashboardOverview {
  total_goods: number; total_users: number; total_orders: number
  today_orders: number; pending_orders: number; total_revenue: number
}
export function getDashboardOverview() {
  return request.get<DashboardOverview>('/sys/dashboard/overview')
}
