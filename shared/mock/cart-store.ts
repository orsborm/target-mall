/**
 * Shared cart mock store — JSON-file-backed (survives dev-server restarts).
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'
import { getGoods, getSkus } from './goods-store'

const DATA_FILE = path.resolve(__dirname, 'data', 'cart.json')

interface CartEntry {
  id: number
  user_id: number
  spu_id: number
  sku_id: number
  quantity: number
  checked: boolean
}

interface StoreData {
  nextId: number
  carts: CartEntry[]
}

function seed(): StoreData {
  const goods = getGoods()
  const skusAll = getSkus()
  const carts: CartEntry[] = []
  let nextId = 50
  if (goods.length > 0) {
    const g1 = goods[0]; const g1Skus = skusAll.filter(s => s.spu_id === g1.id)
    if (g1Skus.length > 0) carts.push({ id: nextId++, user_id: 1, spu_id: g1.id, sku_id: g1Skus[0].id, quantity: 2, checked: true })
    const g2 = goods[1]; const g2Skus = skusAll.filter(s => s.spu_id === g2.id)
    if (g2Skus.length > 0) carts.push({ id: nextId++, user_id: 1, spu_id: g2.id, sku_id: g2Skus[0].id, quantity: 1, checked: true })
  }
  return { nextId, carts }
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

// Initialize
reload()

function enrich(items: CartEntry[]): any[] {
  const goods = getGoods()
  const skusAll = getSkus()
  return items.map(item => {
    const g = goods.find(g => g.id === item.spu_id)
    const sku = skusAll.find(s => s.id === item.sku_id && s.spu_id === item.spu_id)
    return {
      id: item.id,
      spu_id: item.spu_id,
      sku_id: item.sku_id,
      spu_name: g?.name || '',
      main_image: sku?.main_image || g?.main_image || '',
      price: sku?.price || g?.min_price || 0,
      quantity: item.quantity,
      stock: sku?.stock || 0,
      checked: item.checked,
      created_at: new Date().toISOString(),
    }
  })
}

export function getCart(userId: number) {
  return enrich(reload().carts.filter(c => c.user_id === userId))
}

export function addCartItem(userId: number, skuId: number, quantity: number) {
  const skusAll = getSkus()
  const sku = skusAll.find(s => s.id === skuId)
  if (!sku) return null
  const s = reload()
  const existing = s.carts.find(c => c.user_id === userId && c.sku_id === skuId)
  if (existing) {
    existing.quantity += quantity
    save(s)
    return existing
  }
  const entry: CartEntry = { id: s.nextId++, user_id: userId, spu_id: sku.spu_id, sku_id: skuId, quantity, checked: true }
  s.carts.push(entry)
  save(s)
  return entry
}

export function updateCartQty(userId: number, cartId: number, quantity: number): boolean {
  const s = reload()
  const c = s.carts.find(c => c.id === cartId && c.user_id === userId)
  if (!c) return false
  c.quantity = Math.max(1, quantity)
  save(s)
  return true
}

export function toggleCartChecked(userId: number, ids: number[], checked: boolean) {
  const s = reload()
  s.carts.forEach(c => { if (c.user_id === userId && ids.includes(c.id)) c.checked = checked })
  save(s)
}

export function toggleAllChecked(userId: number, checked: boolean) {
  const s = reload()
  s.carts.forEach(c => { if (c.user_id === userId) c.checked = checked })
  save(s)
}

export function removeCartItemsFn(userId: number, ids: number[]) {
  const s = reload()
  for (let i = s.carts.length - 1; i >= 0; i--) {
    if (s.carts[i].user_id === userId && ids.includes(s.carts[i].id)) s.carts.splice(i, 1)
  }
  save(s)
}

export function getCartCountFn(userId: number): number {
  return reload().carts.filter(c => c.user_id === userId).reduce((s, c) => s + c.quantity, 0)
}
