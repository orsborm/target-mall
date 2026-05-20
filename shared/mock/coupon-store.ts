/**
 * Shared coupon mock store — JSON-file-backed.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'coupons.json')

export interface CouponTemplate {
  id: number
  name: string
  type: 'fixed' | 'percent'  // 满减 | 折扣
  threshold: number          // 门槛金额(分)
  value: number              // 面额(分) 或 折扣率(如85=8.5折)
  total_qty: number
  used_qty: number
  start_time: string
  end_time: string
  status: number             // 1=启用 0=停用
  created_at: string
}

export interface UserCoupon {
  id: number
  user_id: number
  coupon_id: number
  status: 'unused' | 'used' | 'expired'
  used_at: string | null
  created_at: string
}

interface StoreData {
  nextCouponId: number
  nextUserCouponId: number
  coupons: CouponTemplate[]
  userCoupons: UserCoupon[]
}

function seed(): StoreData {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 86400000)
  return {
    nextCouponId: 4,
    nextUserCouponId: 1,
    coupons: [
      { id: 1, name: '满99减10', type: 'fixed', threshold: 9900, value: 1000, total_qty: 100, used_qty: 12, start_time: new Date(now.getTime() - 86400000).toISOString(), end_time: nextWeek.toISOString(), status: 1, created_at: now.toISOString() },
      { id: 2, name: '满199减30', type: 'fixed', threshold: 19900, value: 3000, total_qty: 50, used_qty: 5, start_time: new Date(now.getTime() - 86400000).toISOString(), end_time: nextWeek.toISOString(), status: 1, created_at: now.toISOString() },
      { id: 3, name: '9.5折券', type: 'percent', threshold: 0, value: 95, total_qty: 200, used_qty: 30, start_time: new Date(now.getTime() - 86400000).toISOString(), end_time: nextWeek.toISOString(), status: 1, created_at: now.toISOString() },
    ],
    userCoupons: [],
  }
}

let _couponCache: StoreData = seed()
let _couponCacheTime = 0
const COUPON_CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (_couponCache && now - _couponCacheTime < COUPON_CACHE_TTL) return _couponCache
  try {
    if (fs.existsSync(DATA_FILE)) {
      _couponCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _couponCacheTime = now
      return _couponCache
    }
  } catch {
    // Backup corrupt file before reseeding
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  _couponCache = d
  _couponCacheTime = now
  return d
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
    _couponCache = data
    _couponCacheTime = Date.now()
  } catch { /* ignore */ }
}

export function getAvailableCoupons(): CouponTemplate[] {
  const s = reload()
  const now = new Date().toISOString()
  return s.coupons.filter(c => c.status === 1 && c.start_time <= now && c.end_time >= now && c.used_qty < c.total_qty)
}

export function getUserCoupons(userId: number): (UserCoupon & { coupon: CouponTemplate })[] {
  const s = reload()
  return s.userCoupons
    .filter(uc => uc.user_id === userId)
    .map(uc => {
      const coupon = s.coupons.find(c => c.id === uc.coupon_id)
      return { ...uc, coupon }
    })
    .filter(x => x.coupon != null) as (UserCoupon & { coupon: CouponTemplate })[]
}

export function claimCoupon(userId: number, couponId: number): boolean {
  const s = reload()
  const c = s.coupons.find(c => c.id === couponId)
  if (!c || c.status !== 1 || c.used_qty >= c.total_qty) return false
  const already = s.userCoupons.find(uc => uc.user_id === userId && uc.coupon_id === couponId)
  if (already) return false
  s.userCoupons.push({ id: s.nextUserCouponId++, user_id: userId, coupon_id: couponId, status: 'unused', used_at: null, created_at: new Date().toISOString() })
  c.used_qty++
  save(s)
  return true
}

export function useCoupon(userId: number, couponId: number): boolean {
  const s = reload()
  const uc = s.userCoupons.find(u => u.user_id === userId && u.coupon_id === couponId && u.status === 'unused')
  if (!uc) return false
  uc.status = 'used'
  uc.used_at = new Date().toISOString()
  // Do NOT increment tpl.used_qty here — claimCoupon already did that
  // when the user claimed the coupon. Double-incrementing would over-count.
  save(s)
  return true
}

export function getCouponDiscount(couponId: number, totalAmount: number): number {
  const s = reload()
  const c = s.coupons.find(c => c.id === couponId)
  if (!c || c.status !== 1) return 0
  if (totalAmount < c.threshold) return 0
  if (c.type === 'fixed') return Math.min(c.value, totalAmount)  // cap at total
  // percent: value is 1-99 representing discount rate
  const rate = Math.min(99, Math.max(1, c.value))
  return Math.floor(totalAmount * (100 - rate) / 100)
}

export function getAllCoupons(): CouponTemplate[] {
  return reload().coupons
}

export function createCoupon(data: Omit<CouponTemplate, 'id' | 'used_qty' | 'created_at'>): CouponTemplate {
  if (!data.name || !data.name.trim()) throw new Error('优惠券名称不能为空')
  if (data.type !== 'fixed' && data.type !== 'percent') throw new Error('优惠券类型无效')
  if (data.threshold < 0) throw new Error('门槛金额不能为负')
  if (data.value <= 0) throw new Error('面额必须大于0')
  if (data.type === 'percent' && (data.value < 1 || data.value > 99)) throw new Error('折扣率需在1-99之间')
  if (data.type === 'fixed' && data.value > data.threshold && data.threshold > 0) throw new Error('满减券面额不能大于门槛')
  if (new Date(data.end_time) <= new Date(data.start_time)) throw new Error('结束时间必须在开始时间之后')
  if (data.total_qty < 1) throw new Error('发放总量至少为1')
  const s = reload()
  const c: CouponTemplate = { ...data, id: s.nextCouponId++, used_qty: 0, created_at: new Date().toISOString() }
  s.coupons.push(c)
  save(s)
  return c
}

export function deleteCoupon(id: number): boolean {
  const s = reload()
  const idx = s.coupons.findIndex(c => c.id === id)
  if (idx === -1) return false
  s.coupons.splice(idx, 1)
  // Also remove any user-coupon references
  for (let i = s.userCoupons.length - 1; i >= 0; i--) {
    if (s.userCoupons[i].coupon_id === id) s.userCoupons.splice(i, 1)
  }
  save(s)
  return true
}

export function updateCoupon(id: number, patch: Partial<CouponTemplate>): boolean {
  if (patch.type !== undefined && patch.type !== 'fixed' && patch.type !== 'percent') return false
  if (patch.value !== undefined && patch.value <= 0) return false
  if (patch.type === 'percent' && patch.value !== undefined && (patch.value < 1 || patch.value > 99)) return false
  if (patch.threshold !== undefined && patch.threshold < 0) return false
  if (patch.start_time && patch.end_time && new Date(patch.end_time) <= new Date(patch.start_time)) return false
  const s = reload()
  const c = s.coupons.find(c => c.id === id)
  if (!c) return false
  Object.assign(c, patch)
  save(s)
  return true
}
