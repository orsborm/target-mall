import request from './request'

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

export function getCartList() {
  return request.get<CartItem[]>('/order/cart/')
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
  const items = await getCartList().catch(() => [] as CartItem[])
  return { count: items.reduce((s, i) => s + i.quantity, 0) }
}
