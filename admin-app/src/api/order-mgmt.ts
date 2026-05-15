import request from './request'

export interface AdminOrderItem {
  id: number; sku_id: number; spu_name: string
  price: number; quantity: number; total_amount: number; main_image: string
}
export interface AdminOrder {
  id: number; order_no: string; status: string
  total_amount: number; pay_amount: number; freight_amount: number; discount_amount: number
  address_snapshot: { name: string; phone: string; full_address: string } | string
  remark: string; user_id: number; username: string
  items: AdminOrderItem[]; created_at: string; paid_at: string | null
  shipping_company: string; tracking_no: string; shipped_at: string | null
  refund: { refund_amount: number; reason: string; description: string; status: number; reject_reason: string } | null
}

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

export function getOrderList(params?: { page?: number; page_size?: number; status?: string; keyword?: string }) {
  return request.get<{ list: AdminOrder[]; total: number; page: number; page_size: number }>('/order/admin/orders/list', { params })
}
export function processRefund(orderId: number, action: 'approve' | 'reject', reason?: string) {
  return request.put(`/order/admin/orders/${orderId}/refund`, { action, reason })
}
export function updateShipping(orderId: number, company: string, trackingNo: string) {
  return request.put(`/order/admin/orders/${orderId}/shipping`, { company, tracking_no: trackingNo })
}
export function updateRemark(orderId: number, remark: string) {
  return request.put(`/order/admin/orders/${orderId}/remark`, { remark })
}
