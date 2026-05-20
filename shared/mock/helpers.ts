/**
 * Shared mock utilities — used by both admin-app and h5-app mock servers.
 */
import { getSkus } from './goods-store'
import * as fs from 'fs'
import * as path from 'path'

export function json(res: any, data: any, code = 0, msg = 'ok') {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ code, msg, data }))
}

export function paginated(list: any[], page: number, pageSize: number) {
  const p = Math.max(1, page)
  const ps = Math.max(1, Math.min(100, pageSize))
  const start = (p - 1) * ps
  return {
    list: list.slice(start, start + ps),
    total: list.length,
    page: p,
    page_size: ps,
  }
}


export function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: string) => (body += chunk))
    req.on('end', () => {
      if (!body || !body.trim()) return resolve({})
      try { resolve(JSON.parse(body)) } catch (e) {
        console.error('[mock] JSON parse error:', (e as Error).message, 'body:', body.slice(0, 200))
        resolve({ _parseError: true })
      }
    })
  })
}

// ---- Atomic write helper with cross-process lock ----
// Uses a .lock file as a simple mutex to prevent admin-app and h5-app
// dev servers from interleaving writes to the same JSON file (P0-6~12).
// Busy-wait spin-lock is acceptable for mock dev servers where writes
// are rare (< 1/s) and fast (< 1ms).
export function atomicWrite(filePath: string, data: string): void {
  const lockFile = filePath + '.lock'
  const maxWait = 3000
  const start = Date.now()
  while (fs.existsSync(lockFile)) {
    if (Date.now() - start > maxWait) {
      console.warn('[mock] lock timeout for', path.basename(filePath))
      break
    }
    const t = Date.now(); while (Date.now() - t < 2) {} // ~2ms spin
  }
  try {
    fs.writeFileSync(lockFile, '', 'utf-8')
    const tmp = filePath + '.tmp.' + Date.now()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmp, data, 'utf-8')
    fs.renameSync(tmp, filePath)
  } catch {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch { /* best effort */ }
    try { fs.writeFileSync(filePath, data, 'utf-8') } catch (e) {
      console.error('[mock] Failed to write', filePath, (e as Error).message)
    }
  } finally {
    try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile) } catch { /* best effort */ }
  }
}

export function enrichWithStock(goods: any[]): any[] {
  const skusAll = getSkus()
  return goods.map(g => {
    const gSkus = skusAll.filter(s => s.spu_id === g.id)
    return { ...g, total_stock: gSkus.reduce((sum: number, s: any) => sum + s.stock, 0) }
  })
}
