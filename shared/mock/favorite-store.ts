/**
 * Shared favorite/wishlist mock store — JSON-file-backed.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'favorites.json')

interface FavoriteItem {
  id: number
  user_id: number
  spu_id: number
  created_at: string
}

interface StoreData {
  nextId: number
  favorites: FavoriteItem[]
}

function seed(): StoreData {
  return { nextId: 1, favorites: [] }
}

let _favCache: StoreData = seed()
let _favCacheTime = 0
const FAV_CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (_favCache && now - _favCacheTime < FAV_CACHE_TTL) return _favCache
  try {
    if (fs.existsSync(DATA_FILE)) {
      _favCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _favCacheTime = now
      return _favCache
    }
  } catch {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  _favCache = d
  _favCacheTime = now
  return d
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
    _favCache = data
    _favCacheTime = Date.now()
  } catch { /* ignore */ }
}

export function getFavorites(userId: number): number[] {
  const s = reload()
  return s.favorites.filter(f => f.user_id === userId).map(f => f.spu_id)
}

export function isFavorited(userId: number, spuId: number): boolean {
  const s = reload()
  return s.favorites.some(f => f.user_id === userId && f.spu_id === spuId)
}

export function toggleFavorite(userId: number, spuId: number): boolean {
  const s = reload()
  const idx = s.favorites.findIndex(f => f.user_id === userId && f.spu_id === spuId)
  if (idx !== -1) {
    s.favorites.splice(idx, 1)
    save(s)
    return false  // unfavorited
  }
  s.favorites.push({ id: s.nextId++, user_id: userId, spu_id: spuId, created_at: new Date().toISOString() })
  save(s)
  return true  // favorited
}

export function removeFavorites(userId: number, spuIds: number[]): void {
  const s = reload()
  s.favorites = s.favorites.filter(f => !(f.user_id === userId && spuIds.includes(f.spu_id)))
  save(s)
}
