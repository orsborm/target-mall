import request from './request'
import { getGoodsDetailFull } from './goods'

export interface CartItem {
  id: number
  spu_id: number
  sku_id: number
  spu_name: string
  main_image: string
  price: number
  quantity: number
  stock: number
  checked: boolean
  created_at: string
}

export interface AddCartParams {
  sku_id: number
  quantity: number
}

/** Fetch cart list and enrich items with product name, price, and stock from goods API */
export async function getCartList(): Promise<CartItem[]> {
  const items = await request.get<CartItem[]>('/order/cart/')

  const spuIds = [...new Set(items.map((i) => i.spu_id))]

  const details = await Promise.all(
    spuIds.map((id) => getGoodsDetailFull(id).catch((e) => { if (import.meta.env.DEV) console.error(`Failed to fetch goods detail for SPU ${id}:`, e); return null })),
  )

  const goodsMap = new Map<number, { name: string; main_image: string; skus: Map<number, { price: number; stock: number }> }>()
  details.forEach((detail) => {
    if (!detail) return
    const skuMap = new Map<number, { price: number; stock: number }>()
    detail.skus.forEach((sku) => skuMap.set(sku.id, { price: sku.price, stock: sku.stock }))
    goodsMap.set(detail.spu.id, { name: detail.spu.name, main_image: detail.spu.main_image, skus: skuMap })
  })

  return items.map((item) => {
    const goods = goodsMap.get(item.spu_id)
    const sku = goods?.skus.get(item.sku_id)
    return {
      ...item,
      spu_name: item.spu_name || goods?.name || '',
      main_image: item.main_image || goods?.main_image || '',
      price: item.price || sku?.price || 0,
      stock: item.stock || sku?.stock || 0,
    }
  })
}

export function addToCart(data: AddCartParams) {
  return request.post<null>('/order/cart/', data)
}

export function updateCartItem(id: number, data: { quantity: number }) {
  return request.put<null>(`/order/cart/${id}`, data)
}

export function toggleCartItems(ids: number[], checked: boolean) {
  return request.put<null>('/order/cart/checked', { ids, checked })
}

export function removeCartItems(ids: number[]) {
  return request.delete<null>('/order/cart/', { data: { ids } })
}

export function toggleSelectAll(checked: boolean) {
  return request.put<null>('/order/cart/check-all', { checked })
}

export async function getCartCount() {
  const items = await getCartList().catch((e) => { if (import.meta.env.DEV) console.error('Failed to fetch cart count:', e); return [] as CartItem[] })
  return { count: items.reduce((s, i) => s + i.quantity, 0) }
}
