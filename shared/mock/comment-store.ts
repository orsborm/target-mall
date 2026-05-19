/**
 * Shared comment/review mock store — JSON-file-backed.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'comments.json')

export interface CommentItem {
  id: number
  spu_id: number
  user_id: number
  username: string
  rating: number       // 1-5
  content: string
  images: string[]
  created_at: string
}

interface StoreData {
  nextId: number
  comments: CommentItem[]
}

function seed(): StoreData {
  return { nextId: 1, comments: [] }
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
    _commentCache = data
    _commentCacheTime = Date.now()
  } catch { /* ignore */ }
}

let _commentCache: StoreData = seed()
let _commentCacheTime = 0
const COMMENT_CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (_commentCache && now - _commentCacheTime < COMMENT_CACHE_TTL) return _commentCache
  try {
    if (fs.existsSync(DATA_FILE)) {
      _commentCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _commentCacheTime = now
      return _commentCache
    }
  } catch {
    // Backup corrupt file before reseeding
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  return d
}

export function getComments(spuId: number, page: number, pageSize: number): { list: CommentItem[]; total: number; avgRating: number } {
  const s = reload()
  const list = s.comments.filter(c => c.spu_id === spuId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const total = list.length
  const avgRating = total > 0 ? Math.round(list.reduce((sum, c) => sum + c.rating, 0) / total * 10) / 10 : 0
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, avgRating }
}

export function addComment(data: Omit<CommentItem, 'id' | 'created_at'>): CommentItem {
  if (!data.content || !data.content.trim()) throw new Error('评论内容不能为空')
  if (data.rating < 1 || data.rating > 5) throw new Error('评分需在1-5之间')
  const s = reload()
  const comment: CommentItem = {
    ...data,
    rating: Math.min(5, Math.max(1, data.rating)),  // clamp rating
    id: s.nextId++,
    created_at: new Date().toISOString(),
  }
  s.comments.unshift(comment)
  save(s)
  return comment
}

export function deleteComment(id: number): boolean {
  const s = reload()
  const idx = s.comments.findIndex(c => c.id === id)
  if (idx === -1) return false
  s.comments.splice(idx, 1)
  save(s)
  return true
}

export function getAllComments(spuIdFilter?: number, page = 1, pageSize = 20): { list: CommentItem[]; total: number; page: number; page_size: number } {
  const s = reload()
  let list = s.comments
  if (spuIdFilter !== undefined) list = list.filter(c => c.spu_id === spuIdFilter)
  list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, page_size: pageSize }
}

export function getUserCanComment(spuId: number, userId: number): boolean {
  const s = reload()
  return !s.comments.some(c => c.spu_id === spuId && c.user_id === userId)
}
