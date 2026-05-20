/**
 * Shared notification/消息 mock store — JSON-file-backed.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'notifications.json')

export interface NotificationItem {
  id: number
  user_id: number
  msg_msg_type: 'system' | 'order' | 'promotion'
  title: string
  content: string
  related_order_no?: string
  is_read: boolean
  created_at: string
}

interface StoreData {
  nextId: number
  notifications: NotificationItem[]
}

function seed(): StoreData {
  const now = Date.now()
  const day = 86400000
  return {
    nextId: 8,
    notifications: [
      { id: 1, user_id: 1, msg_type: 'system', title: '欢迎来到靶机商城', content: '感谢您的注册！靶机商城是一个安全练习平台，仅供学习和自动化测试使用。', is_read: false, created_at: new Date(now - 3 * day).toISOString() },
      { id: 2, user_id: 1, msg_type: 'order', title: '订单已发货', content: '您的订单 ORD1779194150251 已由顺丰速运发出，快递单号 SF1234567890，请注意查收。', related_order_no: 'ORD1779194150251', is_read: false, created_at: new Date(now - 2 * day).toISOString() },
      { id: 3, user_id: 1, msg_type: 'promotion', title: '618年中大促', content: '全场低至5折，满199减30！快来抢购吧！', is_read: false, created_at: new Date(now - day).toISOString() },
      { id: 4, user_id: 1, msg_type: 'order', title: '订单已签收', content: '您的订单 ORD1779194050251 已确认收货。如有问题请联系客服。', related_order_no: 'ORD1779194050251', is_read: true, created_at: new Date(now - 5 * day).toISOString() },
      { id: 5, user_id: 1, msg_type: 'system', title: '账号安全提示', content: '建议定期修改密码以保障账号安全。您可以在个人中心进行密码修改。', is_read: true, created_at: new Date(now - 7 * day).toISOString() },
      { id: 6, user_id: 1, msg_type: 'order', title: '退款已到账', content: '您的退款申请已审核通过，退款金额已原路返回，预计3-7个工作日到账。', related_order_no: 'ORD1779194250251', is_read: false, created_at: new Date(now - day).toISOString() },
      { id: 7, user_id: 1, msg_type: 'promotion', title: '新用户专享优惠', content: '新用户首单享9.5折优惠，快去领券中心领取吧！', is_read: false, created_at: new Date(now - 4 * day).toISOString() },
    ],
  }
}

let _cache: StoreData = seed()
let _cacheTime = 0
const CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache
  try {
    if (fs.existsSync(DATA_FILE)) {
      _cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _cacheTime = now
      return _cache
    }
  } catch {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  _cache = d
  _cacheTime = now
  return d
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
    _cache = data
    _cacheTime = Date.now()
  } catch { /* ignore */ }
}

// ---- public API ----

export function getNotifications(userId: number, page = 1, pageSize = 20) {
  const s = reload()
  const list = s.notifications
    .filter(n => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, page_size: pageSize }
}

export function getUnreadCount(userId: number): number {
  return reload().notifications.filter(n => n.user_id === userId && !n.is_read).length
}

export function markAsRead(notificationId: number, userId: number): boolean {
  const s = reload()
  const n = s.notifications.find(n => n.id === notificationId && n.user_id === userId)
  if (!n) return false
  n.is_read = true
  save(s)
  return true
}

export function markAllAsRead(userId: number): void {
  const s = reload()
  s.notifications.forEach(n => { if (n.user_id === userId) n.is_read = true })
  save(s)
}

export function deleteNotification(notificationId: number, userId: number): boolean {
  const s = reload()
  const idx = s.notifications.findIndex(n => n.id === notificationId && n.user_id === userId)
  if (idx === -1) return false
  s.notifications.splice(idx, 1)
  save(s)
  return true
}

// ---- Admin API ----

export function getAllNotifications(page = 1, pageSize = 20, type?: string) {
  const s = reload()
  let list = [...s.notifications]
  if (type && type !== 'all') list = list.filter(n => n.msg_type === type)
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, page_size: pageSize }
}

export function createNotification(data: Omit<NotificationItem, 'id' | 'created_at' | 'is_read'>): NotificationItem {
  if (!data.title?.trim()) throw new Error('标题不能为空')
  if (!data.content?.trim()) throw new Error('内容不能为空')
  const s = reload()
  const n: NotificationItem = {
    ...data,
    id: s.nextId++,
    msg_type: data.msg_type || 'system',
    title: data.title.trim(),
    content: data.content.trim(),
    user_id: data.user_id || 1,
    is_read: false,
    created_at: new Date().toISOString(),
  }
  s.notifications.unshift(n)
  save(s)
  return n
}

export function deleteAdminNotification(id: number): boolean {
  const s = reload()
  const idx = s.notifications.findIndex(n => n.id === id)
  if (idx === -1) return false
  s.notifications.splice(idx, 1)
  save(s)
  return true
}
