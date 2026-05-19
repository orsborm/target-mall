import request from './request'

export interface CouponTemplate {
  id: number; name: string; type: 'fixed' | 'percent'
  threshold: number; value: number
  total_qty: number; used_qty: number
  start_time: string; end_time: string
  status: number; created_at: string
}

export function getCouponList() {
  return request.get<CouponTemplate[]>('/sys/coupon/list')
}
export function createCoupon(data: Omit<CouponTemplate, 'id' | 'used_qty' | 'created_at'>) {
  return request.post<CouponTemplate>('/sys/coupon/', data)
}
export function updateCoupon(id: number, data: Partial<CouponTemplate>) {
  return request.put(`/sys/coupon/${id}`, data)
}
export function deleteCoupon(id: number) {
  return request.delete(`/sys/coupon/${id}`)
}
export function toggleCouponStatus(id: number, status: number) {
  return request.put(`/sys/coupon/${id}/status`, { status })
}
