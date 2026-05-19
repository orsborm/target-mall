/**
 * Shared page-config mock store — JSON-file-backed.
 * Used by admin to manage banners, and by h5 to display them.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'page-configs.json')

export interface PageConfig {
  id: number
  page_key: string       // e.g. "home"
  key: string            // e.g. "home_banner_1"
  type: string           // "image" | "text"
  value: string          // image URL or text content
  label: string          // admin display label
  link: string           // click target URL (e.g. /goods/1 or https://...)
  sort_order: number
}

interface StoreData {
  nextId: number
  configs: PageConfig[]
}

function seed(): StoreData {
  return {
    configs: [
      { id: 1, page_key: 'home', key: 'home_banner_1', type: 'image', value: 'https://picsum.photos/seed/banner1/800/300', label: '轮播图1', link: '/goods/1', sort_order: 1 },
      { id: 2, page_key: 'home', key: 'home_banner_2', type: 'image', value: 'https://picsum.photos/seed/banner2/800/300', label: '轮播图2', link: '/goods/2', sort_order: 2 },
      { id: 3, page_key: 'home', key: 'home_title', type: 'text', value: 'H5靶机商城', label: '首页标题', link: '', sort_order: 0 },
      { id: 4, page_key: 'home', key: 'home_subtitle', type: 'text', value: '安全练习 | 自动化练手 | 不断进化', label: '首页副标题', link: '', sort_order: 0 },
      { id: 5, page_key: 'home', key: 'home_promo', type: 'text', value: '618年中大促 — 全场低至5折，满199减30', label: '618大促', link: '/goods/list', sort_order: 3 },
      { id: 6, page_key: 'order', key: 'freight_free_threshold', type: 'text', value: '9900', label: '包邮门槛(分)', link: '', sort_order: 0 },
      { id: 7, page_key: 'order', key: 'freight_fee', type: 'text', value: '800', label: '运费(分)', link: '', sort_order: 0 },
    ],
    nextId: 8,
  }
}

let _pageConfigCache: StoreData = seed()
let _pageConfigCacheTime = 0
const PC_CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (_pageConfigCache && now - _pageConfigCacheTime < PC_CACHE_TTL) return _pageConfigCache
  try {
    if (fs.existsSync(DATA_FILE)) {
      _pageConfigCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _pageConfigCacheTime = now
      return _pageConfigCache
    }
  } catch {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  _pageConfigCache = d
  _pageConfigCacheTime = now
  return d
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
    _pageConfigCache = data
    _pageConfigCacheTime = Date.now()
  } catch { /* ignore */ }
}

// Compatibility — replace loadOrSeed calls
function loadOrSeed(): StoreData { return reload() }

export function getPageConfigs(pageKey: string): PageConfig[] {
  const s = loadOrSeed()
  return s.configs
    .filter(c => c.page_key === pageKey)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function addPageConfig(data: Omit<PageConfig, 'id'>): PageConfig {
  const s = loadOrSeed()
  const c: PageConfig = { ...data, id: s.nextId++ }
  s.configs.push(c)
  save(s)
  return c
}

export function updatePageConfig(id: number, patch: Partial<PageConfig>): boolean {
  const s = loadOrSeed()
  const c = s.configs.find(c => c.id === id)
  if (!c) return false
  Object.assign(c, patch)
  save(s)
  return true
}

export function deletePageConfig(id: number): boolean {
  const s = loadOrSeed()
  const idx = s.configs.findIndex(c => c.id === id)
  if (idx === -1) return false
  s.configs.splice(idx, 1)
  save(s)
  return true
}

export function reorderPageConfigs(pageKey: string, ids: number[]): void {
  const s = loadOrSeed()
  ids.forEach((id, i) => {
    const c = s.configs.find(c => c.id === id && c.page_key === pageKey)
    if (c) c.sort_order = i + 1
  })
  save(s)
}
