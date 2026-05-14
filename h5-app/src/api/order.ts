import request from './request'
import type { PageData } from './request'

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'received' | 'completed' | 'cancelled' | 'refunding' | 'refunded'
export type PayMethod = 'wechat' | 'alipay'

export const ORDER_STATUS_MAP: Record<string, { text: string; type: string }> = {
  pending_payment: { text: '待付款', type: 'danger' },
  paid: { text: '已付款', type: 'warning' },
  shipped: { text: '已发货', type: 'primary' },
  received: { text: '已收货', type: 'success' },
  completed: { text: '已完成', type: 'info' },
  cancelled: { text: '已取消', type: 'info' },
  refunding: { text: '退款中', type: 'warning' },
  refunded: { text: '已退款', type: 'info' },
}

export interface OrderItem {
  id: number
  sku_id: number
  spu_name: string
  main_image: string
  price: number
  quantity: number
  total_amount: number
}

export interface OrderInfo {
  id: number
  order_no: string
  total_amount: number
  pay_amount: number
  freight_amount: number
  discount_amount: number
  status: OrderStatus
  items: OrderItem[]
  address_snapshot: {
    name: string
    phone: string
    full_address: string
  }
  created_at: string
  paid_at?: string
  shipped_at?: string
  remark?: string
}

export interface CreateOrderParams {
  cart_item_ids: number[]
  address_id: number
  pay_method: PayMethod
  remark?: string
}

export interface OrderListParams {
  page?: number
  page_size?: number
  status?: OrderStatus
}

export function createOrder(data: CreateOrderParams) {
  return request.post<{ order_no: string; pay_url?: string }>('/order/orders/create', data)
}

export function getOrderList(params?: OrderListParams) {
  return request.get<PageData<OrderInfo>>('/order/orders/list', { params })
}

export function getOrderDetail(id: number) {
  return request.get<OrderInfo>(`/order/orders/${id}`)
}

export function cancelOrder(id: number, reason?: string) {
  return request.put<null>(`/order/orders/${id}/cancel`, { reason })
}

export function confirmReceipt(id: number) {
  return request.put<null>(`/order/orders/${id}/confirm`)
}

export function payOrder(order_no: string) {
  return request.post<{ pay_url: string }>('/order/pay/', { order_no })
}

export function requestRefund(id: number, reason?: string) {
  return request.put<null>(`/order/orders/${id}/refund`, { reason })
}
