/**
 * Shared goods data store — JSON-file-backed so admin-app and h5-app share data.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'goods-data.json')

// ---- types ----
export interface GoodsItem {
  id: number; spu_code: string; name: string; subtitle: string
  category_id: number; brand: string; main_image: string; images: string[]
  min_price: number; max_price: number; sales: number; status: number; created_at: string
}

export interface SkuItem {
  id: number; spu_id: number; sku_code: string
  price: number; original_price: number; stock: number
  main_image: string; specs: Record<string, string>
}

interface StoreData {
  nextGoodsId: number
  nextSkuId: number
  goods: GoodsItem[]
  skus: SkuItem[]
}

// ---- seed helpers ----
function seedGoods(): GoodsItem[] {
  return Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    spu_code: `SPU${String(i + 1).padStart(3, '0')}`,
    name: `商品${i + 1} — ${['机械键盘', '无线鼠标', '显示器', '耳机', '充电器'][i % 5]}`,
    subtitle: `${['Cherry轴', '静音微动', '4K分辨率', '降噪', '快充'][i % 5]} 高品质`,
    category_id: (i % 5) + 1,
    brand: ['罗技', '戴尔', '华为', '小米', '索尼'][i % 5],
    main_image: `https://picsum.photos/seed/goods${i + 1}/200/200`,
    images: [],
    min_price: ((i % 10) + 1) * 10000,
    max_price: ((i % 10) + 3) * 12000,
    sales: (i + 1) * 7,
    status: i < 22 ? 1 : 0,
    created_at: new Date(2025, 3, i + 1).toISOString(),
  }))
}

function seedSkus(goods: GoodsItem[]): SkuItem[] {
  let nextId = 100
  const skus: SkuItem[] = []
  goods.forEach((g, gi) => {
    for (let si = 0; si < 3; si++) {
      skus.push({
        id: nextId++, spu_id: g.id,
        sku_code: `${g.spu_code}-SKU${si + 1}`,
        price: g.min_price + si * 5000,
        original_price: g.max_price + si * 3000,
        stock: (gi + si) * 5 + 10,
        main_image: `https://picsum.photos/seed/goods${g.id}sku${si}/200/200`,
        specs: { '颜色': ['黑色', '白色', '灰色'][si], '尺寸': ['S', 'M', 'L'][si] },
      })
    }
  })
  return skus
}

// Map product name keywords to correct category IDs
const NAME_TO_CATEGORY: [string, number][] = [
  ['键盘', 1], ['鼠标', 2], ['显示器', 3], ['耳机', 4], ['充电器', 5],
]

function guessCategory(name: string): number | null {
  for (const [kw, id] of NAME_TO_CATEGORY) {
    if (name.includes(kw)) return id
  }
  return null
}

// ---- load / save ----
function load(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data: StoreData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      // Migrate: fix any goods whose category_id doesn't match their name
      let migrated = false
      for (const g of data.goods) {
        const guessed = guessCategory(g.name)
        if (guessed !== null && g.category_id !== guessed) {
          g.category_id = guessed
          migrated = true
        }
      }
      if (migrated) save(data)
      return data
    }
  } catch {
    // Backup corrupt file before replacing with seed to prevent data loss
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const goods = seedGoods()
  const skus = seedSkus(goods)
  const data: StoreData = { nextGoodsId: 26, nextSkuId: 100 + skus.length, goods, skus }
  save(data)
  return data
}

function save(data: StoreData): void {
  try {
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
  } catch { /* silently ignore write failures */ }
}

let store = load()
let _reloadTime = 0
const RELOAD_TTL = 3000 // cache parsed data for 3s to reduce disk reads

// Reload on every access to pick up changes from the other process (with TTL cache)
function reload(): StoreData {
  const now = Date.now()
  if (now - _reloadTime < RELOAD_TTL) return store
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _reloadTime = now
    }
  } catch { /* use in-memory */ }
  return store
}

// ---- public API ----

export function getGoods(): GoodsItem[] {
  return reload().goods.filter(g => g.status !== -1)  // exclude soft-deleted
}

export function getSkus(): SkuItem[] {
  return reload().skus
}

export function addGoods(g: Omit<GoodsItem, 'id' | 'created_at'>): GoodsItem {
  if (!g.name || !g.name.trim()) throw new Error('商品名称不能为空')
  if (g.min_price < 0 || g.max_price < 0) throw new Error('价格不能为负数')
  if (g.min_price > g.max_price) throw new Error('最低价不能大于最高价')
  const s = reload()
  const id = s.nextGoodsId++
  const item: GoodsItem = {
    ...g, id,
    name: g.name.trim(),
    spu_code: g.spu_code || `SPU${String(id).padStart(3, '0')}`,
    images: g.images || [],
    created_at: new Date().toISOString(),
  }
  s.goods.unshift(item)
  save(s)
  return item
}

export function addSkus(spuId: number, entries: { sku_code: string; price: number; original_price?: number; stock: number; main_image: string; specs: Record<string, string> }[]): SkuItem[] {
  const s = reload()
  const created: SkuItem[] = []
  for (const e of entries) {
    if (e.price < 0) throw new Error('SKU价格不能为负数')
    if (e.stock < 0) throw new Error('SKU库存不能为负数')
    const skuId = s.nextSkuId++
    const sku: SkuItem = {
      id: skuId, spu_id: spuId,
      sku_code: e.sku_code || `SKU${spuId}-${skuId}`,
      price: e.price, original_price: e.original_price ?? e.price,
      stock: e.stock, main_image: e.main_image || '',
      specs: e.specs || {},
    }
    s.skus.push(sku)
    created.push(sku)
  }
  save(s)
  return created
}

export function updateGoods(id: number, patch: Partial<GoodsItem>): boolean {
  const s = reload()
  const g = s.goods.find(g => g.id === id)
  if (!g) return false
  if (patch.min_price !== undefined && patch.max_price !== undefined && patch.min_price > patch.max_price) return false
  if (patch.min_price !== undefined && patch.min_price < 0) return false
  if (patch.max_price !== undefined && patch.max_price < 0) return false
  Object.assign(g, patch)
  save(s)
  return true
}

export function updateGoodsStatus(id: number, status: number): boolean {
  return updateGoods(id, { status })
}

export function deleteGoods(id: number): boolean {
  const s = reload()
  const g = s.goods.find(g => g.id === id)
  if (!g) return false
  g.status = -1  // soft delete
  save(s)
  return true
}

export function updateSku(spuId: number, skuId: number, patch: { main_image?: string; price?: number; stock?: number; original_price?: number; specs?: Record<string,string> }): boolean {
  const s = reload()
  const sku = s.skus.find(sk => sk.id === skuId && sk.spu_id === spuId)
  if (!sku) return false
  if (patch.price !== undefined && patch.price < 0) return false
  if (patch.stock !== undefined && patch.stock < 0) return false
  if (patch.main_image !== undefined) sku.main_image = patch.main_image
  if (patch.price !== undefined) sku.price = patch.price
  if (patch.stock !== undefined) sku.stock = patch.stock
  if (patch.original_price !== undefined) sku.original_price = patch.original_price
  if (patch.specs !== undefined) sku.specs = patch.specs
  save(s)
  return true
}

export function getGoodsDetail(spuId: number): { spu: GoodsItem | null; skus: SkuItem[]; specs: { name: string; values: { value: string }[] }[] } {
  const s = reload()
  const spu = s.goods.find(g => g.id === spuId) || null
  const skus = s.skus.filter(sk => sk.spu_id === spuId)
  const specNames = [...new Set(skus.flatMap(sk => Object.keys(sk.specs || {})))]
  return {
    spu,
    skus,
    specs: specNames.map(name => ({
      name,
      values: [...new Set(skus.map(sk => (sk.specs || {})[name]).filter(v => v != null && v !== ''))].map(v => ({ value: v })),
    })),
  }
}

// ---- category seed / store ----
const CATEGORY_FILE = path.resolve(__dirname, 'data', 'categories.json')

export interface CategoryItem {
  id: number; name: string; icon: string; parent_id: number; level: number; sort_order: number
}

function seedCategories(): { nextCatId: number; categories: CategoryItem[] } {
  return {
    nextCatId: 6,
    categories: [
      { id: 1, name: '键盘', icon: '', parent_id: 0, level: 1, sort_order: 1 },
      { id: 2, name: '鼠标', icon: '', parent_id: 0, level: 1, sort_order: 2 },
      { id: 3, name: '显示器', icon: '', parent_id: 0, level: 1, sort_order: 3 },
      { id: 4, name: '耳机', icon: '', parent_id: 0, level: 1, sort_order: 4 },
      { id: 5, name: '充电器', icon: '', parent_id: 0, level: 1, sort_order: 5 },
    ],
  }
}

let _catStore = seedCategories()
let _catCacheTime = 0

function saveCategories(data: { nextCatId: number; categories: CategoryItem[] }): void {
  try {
    const dir = path.dirname(CATEGORY_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(CATEGORY_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

function reloadCategories(): { nextCatId: number; categories: CategoryItem[] } {
  const now = Date.now()
  if (_catStore && now - _catCacheTime < RELOAD_TTL) return _catStore
  try {
    if (fs.existsSync(CATEGORY_FILE)) {
      _catStore = JSON.parse(fs.readFileSync(CATEGORY_FILE, 'utf-8'))
      _catCacheTime = now
      return _catStore
    }
  } catch { /* fall through */ }
  const d = seedCategories()
  _catStore = d
  _catCacheTime = now
  return d
}

export function getCategories(): CategoryItem[] {
  return reloadCategories().categories
}

export function addCategory(data: Omit<CategoryItem, 'id'>): CategoryItem {
  const s = reloadCategories()
  const cat: CategoryItem = { ...data, id: s.nextCatId++ }
  s.categories.push(cat)
  saveCategories(s)
  return cat
}

export function updateCategory(id: number, patch: Partial<CategoryItem>): boolean {
  const s = reloadCategories()
  const c = s.categories.find(c => c.id === id)
  if (!c) return false
  Object.assign(c, patch)
  saveCategories(s)
  return true
}

export function deleteCategory(id: number): boolean {
  const s = reloadCategories()
  const idx = s.categories.findIndex(c => c.id === id)
  if (idx === -1) return false
  s.categories.splice(idx, 1)
  saveCategories(s)
  return true
}

// ---- list filtering / sorting ----
export interface GoodsFilter {
  keyword?: string
  category_id?: number
  status?: number
  min_price?: number
  max_price?: number
  sort?: string
}

export function queryGoods(filter: GoodsFilter): GoodsItem[] {
  let list = getGoods()

  if (filter.status !== undefined && filter.status !== null) {
    const s = Number(filter.status)
    list = list.filter(g => g.status === s)
  }
  // Use explicit Number() to ensure type-safe comparison
  const catId = Number(filter.category_id)
  if (!isNaN(catId) && catId > 0) {
    list = list.filter(g => Number(g.category_id) === catId)
  }
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase()
    list = list.filter(g => g.name.toLowerCase().includes(kw) || g.subtitle.toLowerCase().includes(kw))
  }
  if (filter.min_price !== undefined && !isNaN(Number(filter.min_price))) {
    const mp = Number(filter.min_price)
    list = list.filter(g => g.max_price >= mp)
  }
  if (filter.max_price !== undefined && !isNaN(Number(filter.max_price))) {
    const mp = Number(filter.max_price)
    list = list.filter(g => g.min_price <= mp)
  }

  switch (filter.sort) {
    case 'price_asc': list.sort((a, b) => a.min_price - b.min_price); break
    case 'price_desc': list.sort((a, b) => b.max_price - a.max_price); break
    case 'sales_desc': list.sort((a, b) => b.sales - a.sales); break
    case 'newest': list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break
  }

  return list
}
