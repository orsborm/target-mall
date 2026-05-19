/**
 * Shared feedback mock store — JSON-file-backed.
 */
import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './helpers'

const DATA_FILE = path.resolve(__dirname, 'data', 'feedbacks.json')

export interface FeedbackEntry {
  id: number
  type: string       // bug | suggest | complaint | other
  content: string
  contact: string
  images: string[]
  status: number     // 0=未处理 1=已处理
  created_at: string
}

interface StoreData {
  nextId: number
  feedbacks: FeedbackEntry[]
}

function seed(): StoreData {
  return { nextId: 1, feedbacks: [] }
}

function load(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.renameSync(DATA_FILE, DATA_FILE + '.backup.' + Date.now()) } catch { /* best effort */ }
    }
  }
  const d = seed()
  save(d)
  return d
}

function save(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    atomicWrite(DATA_FILE, JSON.stringify(data, null, 2))
  } catch { /* ignore */ }
}

let store = load()
let _cacheTime = 0
const CACHE_TTL = 3000

function reload(): StoreData {
  const now = Date.now()
  if (now - _cacheTime < CACHE_TTL) return store
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      _cacheTime = now
    }
  } catch { /* use in-memory */ }
  return store
}

export function addFeedback(data: { type: string; content: string; contact?: string; images?: string[] }): FeedbackEntry {
  const s = reload()
  const entry: FeedbackEntry = {
    id: s.nextId++,
    type: data.type || 'other',
    content: data.content,
    contact: data.contact || '',
    images: data.images || [],
    status: 0,
    created_at: new Date().toISOString(),
  }
  s.feedbacks.unshift(entry)
  save(s)
  return entry
}

export function getFeedbacks(page = 1, pageSize = 20, type?: string): { list: FeedbackEntry[]; total: number; page: number; page_size: number } {
  const s = reload()
  let list = [...s.feedbacks]
  if (type && type !== 'all') list = list.filter(f => f.type === type)
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, page_size: pageSize }
}

export function updateFeedbackStatus(id: number, status: number): boolean {
  const s = reload()
  const f = s.feedbacks.find(f => f.id === id)
  if (!f) return false
  f.status = status
  save(s)
  return true
}
