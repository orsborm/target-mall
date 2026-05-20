/**
 * Shared order mock store — JSON-file-backed so orders survive dev-server restarts.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'
import { getGoods, getSkus } from './goods-store'

const DATA_FILE = path.resolve(__dirname, 'data', 'orders.json')

interface OrderItem {
  id: number; sku_id: number; spu_name: string; price: number; quantity: number; total_amount: number; main_image: string
}

interface OrderEntry {
  id: number
  order_no: string
  user_id: number
  status: string
  total_amount: number
  pay_amount: number
  freight_amount: number
  discount_amount: number
  items: OrderItem[]
  address_snapshot: { name: string; phone: string; full_address: string }
  remark: string
  created_at: string
  paid_at: string | null
  shipping_company: string
  tracking_no: string
  shipped_at: string | null
}

interface StoreData {
  nextId: number
  orders: OrderEntry[]
}

function seed(): StoreData {
  const goods = getGoods(); const skus = getSkus()
  const orders: OrderEntry[] = []
  let nextId = 1000
  for (let i = 0; i < 3; i++) {
    const g = goods[i]; const gSkus = skus.filter(s => s.spu_id === g.id); const sku = gSkus[0]
    orders.push({
      id: nextId++, order_no: `ORD${Date.now() - (3 - i) * 100000}`,
      user_id: 1,
      status: ['completed', 'shipped', 'pending_payment'][i],
      total_amount: (sku?.price || 29900), pay_amount: (sku?.price || 29900),
      freight_amount: 0, discount_amount: 0,
      items: [{ id: i + 1, sku_id: sku?.id || 1, spu_name: g?.name || '示例商品', price: sku?.price || 29900, quantity: 1, total_amount: sku?.price || 29900, main_image: g?.main_image || '' }],
      address_snapshot: { name: '收货人', phone: '13800000000', full_address: '某省某市某区某路1号' },
      remark: '',
      created_at: new Date(Date.now() - (3 - i) * 86400000).toISOString(),
      paid_at: i < 2 ? new Date(Date.now() - (3 - i) * 86400000 + 3600000).toISOString() : null,
      shipping_company: i === 1 ? '顺丰速运' : '', tracking_no: i === 1 ? 'SF1234567890' : '',
      shipped_at: i === 1 ? new Date(Date.now() - 86400000).toISOString() : null,
    })
  }
  return { nextId, orders }
}

function load(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const data = seed()
  save(data)
  return data
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
  } catch { /* silently ignore write failures */ }
}

let store = load()
let _orderReloadTime = 0
const ORDER_RELOAD_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (now - _orderReloadTime < ORDER_RELOAD_TTL) return store
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _orderReloadTime = now
    }
  } catch { /* use in-memory */ }
  return store
}

export function getOrders(userId: number | string, status?: string, page = 1, pageSize = 20) {
  const uid = Number(userId)
  const s = reload()
  // uid=0 means "all users" — used by admin dashboard overview
  let list = uid === 0 ? s.orders : s.orders.filter(o => o.user_id === uid)
  if (status && status !== 'all') list = list.filter(o => o.status === status)
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, page_size: pageSize }
}

export function getOrderDetail(orderId: number): OrderEntry | null {
  const s = reload()
  return s.orders.find(o => o.id === orderId) || null
}

export function updateOrderStatus(orderId: number, status: string): boolean {
  const s = reload()
  const o = s.orders.find(o => o.id === orderId)
  if (!o) return false
  o.status = status
  if (status === 'paid' && !o.paid_at) o.paid_at = new Date().toISOString()
  if (status === 'shipped' && !o.shipped_at) o.shipped_at = new Date().toISOString()
  save(s)
  return true
}

export function payOrder(orderId: number): { pay_no: string; paid: boolean } | false {
  const s = reload()
  const o = s.orders.find(o => o.id === orderId)
  if (!o || o.status !== 'pending_payment') return false
  o.status = 'paid'
  o.paid_at = new Date().toISOString()
  save(s)
  return { pay_no: 'PAY' + Date.now(), paid: true }
}

export function createOrder(data: { user_id: number; items: { sku_id: number; spu_name: string; price: number; quantity: number; main_image: string }[]; total_amount: number; freight_amount: number; discount_amount: number; address_snapshot: { name: string; phone: string; full_address: string }; remark?: string; coupon_id?: number }): OrderEntry {
  if (!data.items || data.items.length === 0) throw new Error('订单项不能为空')
  for (const it of data.items) {
    if (it.price < 0) throw new Error('商品价格不能为负')
    if (it.quantity < 1) throw new Error('商品数量至少为1')
  }
  const s = reload()
  // Append random entropy to prevent duplicate order_no when two requests
  // land in the same millisecond (e.g. double-click submit on checkout).
  const orderNo = `ORD${Date.now()}${s.nextId}${Math.random().toString(36).slice(2, 6)}`
  const entry: OrderEntry = {
    id: s.nextId++,
    order_no: orderNo,
    user_id: data.user_id,
    status: 'pending_payment',
    total_amount: data.total_amount, pay_amount: data.total_amount + data.freight_amount - data.discount_amount,
    freight_amount: data.freight_amount, discount_amount: data.discount_amount,
    items: data.items.map((it, i) => ({ ...it, id: i + 1, total_amount: it.price * it.quantity })),
    address_snapshot: data.address_snapshot,
    remark: data.remark || '',
    created_at: new Date().toISOString(),
    paid_at: null, shipping_company: '', tracking_no: '', shipped_at: null,
  }
  s.orders.unshift(entry)
  save(s)
  return entry
}
