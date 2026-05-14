import request from './request'
import type { PageData } from './request'

export interface GoodsItem {
  id: number
  spu_code: string
  name: string
  subtitle: string
  category_id: number
  brand: string
  main_image: string
  images: string[]
  min_price: number
  max_price: number
  sales: number
  status?: number
  created_at?: string
  detail_html?: string
}

export interface GoodsCategory {
  id: number
  name: string
  icon: string
  parent_id: number
  level: number
  sort_order: number
  children?: GoodsCategory[]
}

export interface GoodsListParams {
  page?: number
  page_size?: number
  keyword?: string
  category_id?: number
  sort?: 'price_asc' | 'price_desc' | 'sales_desc' | 'newest'
  min_price?: number
  max_price?: number
}

export function getGoodsList(params?: GoodsListParams) {
  return request.get<PageData<GoodsItem>>('/goods/spu/list', { params })
}

export interface GoodsDetailResponse {
  spu: GoodsItem
  skus: { id: number; spu_id: number; sku_code: string; price: number; original_price: number; stock: number; specs: Record<string,string>; main_image: string }[]
  specs: { id: number; name: string; values: string[] }[]
}

export function getGoodsDetail(id: number) {
  return request.get<GoodsDetailResponse>(`/goods/spu/${id}`).then(r => r.spu)
}
export function getGoodsDetailFull(id: number) {
  return request.get<GoodsDetailResponse>(`/goods/spu/${id}`)
}

export function getCategoryTree() {
  return request.get<GoodsCategory[]>('/goods/category/tree')
}
