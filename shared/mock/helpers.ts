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

// ---- Atomic write helper (reduces race-condition window) ----
export function atomicWrite(filePath: string, data: string): void {
  const tmp = filePath + '.tmp.' + Date.now()
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmp, data, 'utf-8')
    fs.renameSync(tmp, filePath)
  } catch {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch { /* best effort */ }
    // Fall back to direct write
    try { fs.writeFileSync(filePath, data, 'utf-8') } catch (e) {
      console.error('[mock] Failed to write', filePath, (e as Error).message)
    }
  }
}

export function enrichWithStock(goods: any[]): any[] {
  const skusAll = getSkus()
  return goods.map(g => {
    const gSkus = skusAll.filter(s => s.spu_id === g.id)
    return { ...g, total_stock: gSkus.reduce((sum: number, s: any) => sum + s.stock, 0) }
  })
}
