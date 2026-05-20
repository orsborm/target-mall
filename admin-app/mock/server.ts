/**
 * Admin API mock server — handles endpoints the backend doesn't have yet.
 * Returns proper paginated data so all admin pages work during development.
 */
import type { Plugin } from 'vite'
import {
  getGoods, addGoods, addSkus,
  updateGoodsStatus, updateGoods, updateSku, getGoodsDetail, deleteGoods,
  queryGoods, getCategories, addCategory, updateCategory, deleteCategory as deleteCat,
} from '../../shared/mock/goods-store'
import { json, paginated, parseBody, enrichWithStock } from '../../shared/mock/helpers'
import { getComments as getMockComments, addComment as addMockComment, deleteComment, getAllComments } from '../../shared/mock/comment-store'
import { getFavorites, toggleFavorite, removeFavorites } from '../../shared/mock/favorite-store'
import { getAllCoupons, createCoupon, updateCoupon, deleteCoupon as deleteAdminCoupon } from '../../shared/mock/coupon-store'
import { getPageConfigs, addPageConfig, updatePageConfig, deletePageConfig } from '../../shared/mock/page-config-store'
import { getFeedbacks, updateFeedbackStatus } from '../../shared/mock/feedback-store'
import { getOrders as getSharedOrders, updateOrderStatus as updateSharedOrderStatus } from '../../shared/mock/order-store'
// ^^^ Admin now uses the shared JSON-file-backed order store instead of its
// own in-memory array, so orders created by h5-app users are visible to admin.
// Previously the two mock servers lived in parallel universes.

// ---- mock data stores (in-memory, resets on restart) ----

const users: any[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  username: `user${i + 1}`,
  nickname: `用户${i + 1}`,
  phone: `1380000${String(i).padStart(4, '0')}`,
  email: `user${i + 1}@example.com`,
  role_code: i === 0 ? 'admin' : 'user',
  status: 1,
  created_at: new Date(2025, 0, i + 1).toISOString(),
}))

// Simple auth check for admin mock routes — previously all admin CRUD
// endpoints had zero authentication, making it impossible to test auth
// flows during development. GET requests are left open for read-only
// browsing; mutations require a Bearer token.
function checkAuth(req: any, res: any): boolean {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  if (!header.startsWith('Bearer ')) {
    res.statusCode = 401
    json(res, { msg: '缺少认证信息' }, 40101, 'Unauthorized')
    return false
  }
  return true
}

const logFiles = [
  { name: 'user-service.log', path: 'user/user-service.log', service: 'user', size: 245760, size_bytes: 245760, size_mb: 0.234, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'goods-service.log', path: 'goods/goods-service.log', service: 'goods', size: 512000, size_bytes: 512000, size_mb: 0.488, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'order-service.log', path: 'order/order-service.log', service: 'order', size: 1048576, size_bytes: 1048576, size_mb: 1.0, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'sys-service.log', path: 'sys/sys-service.log', service: 'sys', size: 81920, size_bytes: 81920, size_mb: 0.078, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
]

const logLines = (service: string, lines: number) =>
  Array.from({ length: lines }, (_, i) => {
    const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR']
    const lv = levels[i % 5]
    return `2025-05-${String(14 - Math.floor(i / 100)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00 [${lv}] ${service} - message #${i + 1}`
  })

// ---- route handler ----

export function adminMockPlugin(): Plugin {
  return {
    name: 'admin-mock-api',
    configureServer(server) {
      // --- User management ---
      server.middlewares.use('/api/v1/user/list', async (req, res) => {
        if (!checkAuth(req, res)) return
        const url = new URL(req.url!, 'http://localhost')
        const page = parseInt(url.searchParams.get('page') || '1')
        const pageSize = parseInt(url.searchParams.get('page_size') || '20')
        const keyword = url.searchParams.get('keyword') || ''
        let list = users
        if (keyword) {
          list = list.filter(u => u.username.includes(keyword) || u.nickname.includes(keyword))
        }
        json(res, paginated(list, page, pageSize))
      })

      server.middlewares.use('/api/v1/user/', async (req, res, next) => {
        if (!checkAuth(req, res)) return
        const match = req.url!.match(/^\/(\d+)\/status$/)
        if (!match || req.method !== 'PUT') return next()
        const id = parseInt(match[1])
        const body = await parseBody(req)
        const user = users.find(u => u.id === id)
        if (!user) { res.statusCode = 404; return json(res, {}) }
        user.status = body.status
        json(res, { msg: 'ok' })
      })

      // --- Goods management (via shared store) ---
      server.middlewares.use('/api/v1/goods/spu', async (req, res, next) => {
        if (!['GET'].includes(req.method!) && !checkAuth(req, res)) return
        const url = req.url!
        const method = req.method!

        // GET list
        if (url === '/list' || url.startsWith('/list?')) {
          const u = new URL(url, 'http://localhost')
          const page = Math.max(1, parseInt(u.searchParams.get('page') || '1') || 1)
          const pageSize = Math.min(100, Math.max(1, parseInt(u.searchParams.get('page_size') || '20') || 20))
          const rawCat = u.searchParams.get('category_id')
          const categoryId = rawCat !== null && rawCat !== '' ? Number(rawCat) : undefined
          const list = queryGoods({
            keyword: u.searchParams.get('keyword') || undefined,
            category_id: categoryId,
            status: u.searchParams.has('status') ? Number(u.searchParams.get('status')) : undefined,
            sort: u.searchParams.get('sort') || undefined,
          })
          return json(res, paginated(enrichWithStock(list), page, pageSize))
        }

        // POST create
        if (url === '' || url === '/') {
          if (method !== 'POST') return next()
          const body = await parseBody(req)
          const g = addGoods(body)
          if (Array.isArray(body.skus) && body.skus.length > 0) {
            addSkus(g.id, body.skus)
          }
          return json(res, { id: g.id, msg: 'ok' })
        }

        const statusMatch = url.match(/^\/(\d+)\/status$/)
        const skusMatch = url.match(/^\/(\d+)\/skus$/)
        const detailMatch = url.match(/^\/(\d+)$/)

        if (statusMatch && method === 'PUT') {
          const id = parseInt(statusMatch[1])
          const ok = updateGoodsStatus(id, (await parseBody(req)).status)
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }

        if (skusMatch && method === 'PUT') {
          const spuId = parseInt(skusMatch[1])
          const body = await parseBody(req)
          if (Array.isArray(body.skus)) {
            for (const s of body.skus) {
              updateSku(spuId, s.id, { main_image: s.main_image, price: s.price })
            }
          }
          return json(res, { msg: 'ok' })
        }

        if (detailMatch) {
          const id = parseInt(detailMatch[1])
          if (method === 'GET') {
            const detail = getGoodsDetail(id)
            if (!detail.spu) { res.statusCode = 404; return json(res, {}) }
            return json(res, detail)
          }
          if (method === 'PUT') {
            const body = await parseBody(req)
            const ok = updateGoods(id, body)
            if (!ok) { res.statusCode = 404; return json(res, {}) }
            return json(res, { msg: 'ok' })
          }
          if (method === 'DELETE') {
            const ok = deleteGoods(id)
            if (!ok) { res.statusCode = 404; return json(res, {}) }
            return json(res, { msg: 'ok' })
          }
          return next()
        }

        next()
      })

      // --- Category CRUD ---
      server.middlewares.use('/api/v1/goods/category', async (req, res, next) => {
        if (!['GET'].includes(req.method!) && !checkAuth(req, res)) return
        const url = req.url!
        const method = req.method!
        if (url === '/tree' || url === '/tree/') {
          return json(res, getCategories())
        }
        if ((url === '' || url === '/') && method === 'POST') {
          const body = await parseBody(req)
          const cat = addCategory({
            name: body.name, icon: body.icon || '', parent_id: body.parent_id || 0,
            level: body.level || 1, sort_order: body.sort_order || 1,
          })
          return json(res, cat)
        }
        const match = url.match(/^\/(\d+)$/)
        if (match && method === 'PUT') {
          const body = await parseBody(req)
          const ok = updateCategory(parseInt(match[1]), body)
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }
        if (match && method === 'DELETE') {
          const ok = deleteCat(parseInt(match[1]))
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }
        next()
      })

      // --- Order admin operations (shared store) ---
      server.middlewares.use('/api/v1/order/admin/orders/', async (req, res, next) => {
        if (!checkAuth(req, res)) return
        const refundMatch = req.url!.match(/^\/(\d+)\/refund$/)
        const shippingMatch = req.url!.match(/^\/(\d+)\/shipping$/)
        const remarkMatch = req.url!.match(/^\/(\d+)\/remark$/)
        if (!refundMatch && !shippingMatch && !remarkMatch) return next()

        const id = parseInt((refundMatch || shippingMatch || remarkMatch)![1])
        const body = await parseBody(req)

        if (shippingMatch) {
          const ok = updateSharedOrderStatus(id, 'shipped')
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }
        if (remarkMatch) {
          return json(res, { msg: 'ok' })
        }
        if (refundMatch) {
          if (body.action === 'approve') {
            const ok = updateSharedOrderStatus(id, 'refunded')
            if (!ok) { res.statusCode = 404; return json(res, {}) }
          } else {
            updateSharedOrderStatus(id, 'completed')
          }
          return json(res, { msg: 'ok' })
        }
        next()
      })

      // --- Admin order list (shared store) ---
      server.middlewares.use('/api/v1/order/admin/', async (req, res, next) => {
        if (!checkAuth(req, res)) return
        const listMatch = req.url!.match(/^orders\/list/)
        if (!listMatch || req.method !== 'GET') return next()
        const u = new URL(req.url!, 'http://localhost')
        const page = parseInt(u.searchParams.get('page') || '1')
        const pageSize = parseInt(u.searchParams.get('page_size') || '20')
        const all = getSharedOrders('all', undefined, 1, 1000)
        return json(res, paginated(all.list, page, pageSize))
      })

      // --- Comments / Reviews ---
      server.middlewares.use('/api/v1/goods/comment', async (req, res, next) => {
        const url = req.url!
        const method = req.method!
        if (url === '/list' || url.startsWith('/list?')) {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          const spuIdRaw = u.searchParams.get('spu_id')
          const spuId = spuIdRaw ? parseInt(spuIdRaw) : undefined
          return json(res, getAllComments(spuId, page, pageSize))
        }
        if (url === '' || url === '/') {
          if (method === 'POST') {
            const body = await parseBody(req)
            if (!body.spu_id || !body.content) { res.statusCode = 400; return json(res, { msg: '缺少参数' }) }
            const c = addMockComment({ spu_id: body.spu_id, user_id: body.user_id || 1, username: body.username || '匿名用户', rating: body.rating || 5, content: body.content, images: body.images || [] })
            return json(res, c)
          }
        }
        const match = url.match(/^\/(\d+)$/)
        if (match && method === 'DELETE') {
          deleteComment(parseInt(match[1]))
          return json(res, { msg: 'ok' })
        }
        next()
      })
      server.middlewares.use('/api/v1/goods/spu', (req, res, next) => {
        const url = req.url!
        const commentsMatch = url.match(/^\/(\d+)\/comments$/)
        if (commentsMatch && req.method === 'GET') {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          return json(res, getMockComments(parseInt(commentsMatch[1]), page, pageSize))
        }
        next()
      })

      // --- Favorites ---
      server.middlewares.use('/api/v1/user/favorites', (req, res) => {
        const u = new URL(req.url!, 'http://localhost')
        json(res, getFavorites(parseInt(u.searchParams.get('user_id') || '1')))
      })
      server.middlewares.use('/api/v1/user/favorite', async (req, res) => {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          res.statusCode = 405; return json(res, { msg: 'Method not allowed' })
        }
        const body = await parseBody(req)
        if (req.method === 'DELETE') {
          removeFavorites(body.user_id || 1, body.spu_ids || [])
          return json(res, { msg: 'ok' })
        }
        const result = toggleFavorite(body.user_id || 1, body.spu_id)
        json(res, { favorited: result })
      })

      // --- Coupons (admin) ---
      server.middlewares.use('/api/v1/sys/coupon', async (req, res, next) => {
        if (!['GET'].includes(req.method!) && !checkAuth(req, res)) return
        const url = req.url!
        const method = req.method!
        if (url === '/list' || url === '/list?') {
          return json(res, getAllCoupons())
        }
        if (url === '' || url === '/') {
          if (method === 'POST') {
            const body = await parseBody(req)
            return json(res, createCoupon(body))
          }
        }
        const match = url.match(/^\/(\d+)$/)
        const statusMatch = url.match(/^\/(\d+)\/status$/)
        if (match && method === 'PUT') {
          const body = await parseBody(req)
          updateCoupon(parseInt(match[1]), body)
          return json(res, { msg: 'ok' })
        }
        if (statusMatch && method === 'PUT') {
          const body = await parseBody(req)
          updateCoupon(parseInt(statusMatch[1]), { status: body.status })
          return json(res, { msg: 'ok' })
        }
        if (match && method === 'DELETE') {
          deleteAdminCoupon(parseInt(match[1]))
          return json(res, { msg: 'ok' })
        }
        next()
      })

      // --- Page Configs (banners) ---
      server.middlewares.use('/api/v1/sys/page-config', async (req, res, next) => {
        if (!['GET'].includes(req.method!) && !checkAuth(req, res)) return
        const url = req.url!
        const method = req.method!
        const match = url.match(/^\/([a-z_]+)$/)
        if (match && method === 'GET') {
          return json(res, getPageConfigs(match[1]))
        }
        if ((url === '' || url === '/') && method === 'POST') {
          const body = await parseBody(req)
          return json(res, addPageConfig(body))
        }
        const idMatch = url.match(/^\/(\d+)$/)
        if (idMatch && method === 'PUT') {
          const body = await parseBody(req)
          updatePageConfig(parseInt(idMatch[1]), body)
          return json(res, { msg: 'ok' })
        }
        if (idMatch && method === 'DELETE') {
          deletePageConfig(parseInt(idMatch[1]))
          return json(res, { msg: 'ok' })
        }
        next()
      })

      // --- Dashboard ---
      server.middlewares.use('/api/v1/sys/dashboard/overview', (_req, res) => {
        // uid=0 returns orders for ALL users — required for admin dashboard
        const allOrders = getSharedOrders(0, undefined, 1, 10000)
        const ordersList = allOrders.list
        json(res, {
          total_goods: getGoods().length,
          total_users: users.length,
          total_orders: ordersList.length,
          today_orders: ordersList.filter(o => {
            const d = new Date(o.created_at || 0)
            const t = new Date()
            return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
          }).length,
          pending_orders: ordersList.filter(o => o.status === 'pending_payment' || o.status === 'paid').length,
          total_revenue: ordersList
            .filter(o => ['paid', 'shipped', 'received', 'completed', 'refunding'].includes(o.status))
            .reduce((s: number, o: any) => s + o.pay_amount, 0),
        })
      })

      // --- Log management ---
      server.middlewares.use('/api/v1/sys/log/status', (_req, res) => {
        const totalBytes = logFiles.reduce((s, f) => s + f.size_bytes, 0)
        const totalMb = totalBytes / (1024 * 1024)
        const maxMb = 500
        json(res, {
          status: 'ok', current_mb: Math.round(totalMb * 1000) / 1000, max_mb: maxMb,
          usage_percent: Math.round(totalMb / maxMb * 1000) / 10, auto_cleanup_threshold_mb: 400,
          file_count: logFiles.length,
          files: logFiles.map(f => ({ service: f.service, size_mb: f.size_mb, path: f.path })),
        })
      })

      server.middlewares.use('/api/v1/sys/log/size', (_req, res) => {
        const totalBytes = logFiles.reduce((s, f) => s + f.size_bytes, 0)
        json(res, {
          total_bytes: totalBytes, total_mb: Math.round(totalBytes / (1024 * 1024) * 1000) / 1000,
          max_mb: 500, usage_percent: Math.round(totalBytes / (1024 * 1024) / 500 * 1000) / 10,
          files: logFiles.map(f => ({ service: f.service, size_bytes: f.size_bytes, size_mb: f.size_mb, path: f.path })),
        })
      })

      server.middlewares.use('/api/v1/sys/log/list', (_req, res) => {
        json(res, logFiles)
      })

      server.middlewares.use('/api/v1/sys/log/read', (req, res) => {
        const url = new URL(req.url!, 'http://localhost')
        const service = url.searchParams.get('service') || ''
        const lines = parseInt(url.searchParams.get('lines') || '200')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const all = logLines(service || 'all', lines + offset)
        const chunk = all.slice(offset, offset + lines)
        json(res, {
          service: service || 'all', file: `${service || 'all'}-service.log`,
          lines: chunk, total_lines: 10000, offset, count: chunk.length,
        })
      })

      server.middlewares.use('/api/v1/sys/log/search', (req, res) => {
        const url = new URL(req.url!, 'http://localhost')
        const keyword = url.searchParams.get('keyword') || ''
        const level = url.searchParams.get('level') || ''
        const matches = logLines('all', 500)
          .filter(l => l.toLowerCase().includes(keyword.toLowerCase()))
          .filter(l => !level || l.includes(level))
          .slice(0, 100)
          .map((content, i) => ({
            line: i + 1, content,
            level: content.includes('ERROR') ? 'ERROR' : content.includes('WARN') ? 'WARNING' : 'INFO',
            timestamp: '',
          }))
        json(res, { service: '', keyword, level, matches, total_matches: matches.length })
      })

      server.middlewares.use('/api/v1/sys/log/errors', (req, res) => {
        const url = new URL(req.url!, 'http://localhost')
        const lines = parseInt(url.searchParams.get('lines') || '100')
        const errs = logLines('all', 500).filter(l => l.includes('ERROR') || l.includes('WARN'))
        json(res, { service: '', file: '', lines: errs.slice(0, lines), total_lines: errs.length, offset: 0, count: Math.min(errs.length, lines) })
      })

      server.middlewares.use('/api/v1/sys/log/download', (_req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', 'attachment; filename=logs-mock.txt')
        res.end(logFiles.map(f => `[${f.service}] log content mock\n`).join(''))
      })

      server.middlewares.use('/api/v1/sys/log/clear', (_req, res) => {
        json(res, { cleared_files: logFiles.length })
      })

      server.middlewares.use('/api/v1/sys/log/service/', (req, res) => {
        const name = req.url!.replace(/^\//, '')
        const count = logFiles.filter(f => f.service === name).length
        json(res, { msg: 'ok', deleted: count })
      })

      // --- Captcha ---
      // Backend accepts code "8888" as the universal bypass when Redis is
      // unavailable (see auth_service_patch.py). Show this code in the SVG
      // so the rendered captcha matches what the user must type.
      server.middlewares.use('/api/v1/sys/common/captcha', (_req, res) => {
        const code = '8888'
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">`
          + `<rect width="120" height="40" fill="#f0f0f0"/>`
          + `<text x="24" y="28" font-size="22" fill="#333" font-family="monospace">${code}</text>`
          + `<line x1="10" y1="33" x2="110" y2="23" stroke="#ccc"/>`
          + `<line x1="10" y1="24" x2="110" y2="20" stroke="#ccc"/>`
          + `</svg>`
        const b64 = Buffer.from(svg).toString('base64')
        json(res, {
          captcha_id: 'mock-captcha-' + Date.now(),
          captcha_image: 'data:image/svg+xml;base64,' + b64,
        })
      })

      // --- Feedback management ---
      server.middlewares.use('/api/v1/msg/feedback', async (req, res, next) => {
        if (!['GET'].includes(req.method!) && !checkAuth(req, res)) return
        const url = req.url!
        const method = req.method!
        if (url === '/list' || url.startsWith('/list?')) {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          const type = u.searchParams.get('type') || undefined
          return json(res, getFeedbacks(page, pageSize, type))
        }
        const statusMatch = url.match(/^\/(\d+)\/status$/)
        if (statusMatch && method === 'PUT') {
          const body = await parseBody(req)
          const ok = updateFeedbackStatus(parseInt(statusMatch[1]), body.status)
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }
        next()
      })
    },
  }
}
