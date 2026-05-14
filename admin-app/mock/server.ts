/**
 * Admin API mock server — handles endpoints the backend doesn't have yet.
 * Returns proper paginated data so all admin pages work during development.
 */
import type { Plugin } from 'vite'

function json(res: any, data: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ code: 0, msg: 'ok', data }))
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: string) => (body += chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
  })
}

function paginated(list: any[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    page,
    page_size: pageSize,
  }
}

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

const goods: any[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  spu_code: `SPU00${i + 1}`,
  name: `商品${i + 1} — ${['机械键盘', '无线鼠标', '显示器', '耳机', '充电器'][i % 5]}`,
  subtitle: `${['Cherry轴', '静音微动', '4K分辨率', '降噪', '快充'][i % 5]} 高品质`,
  category_id: (i % 4) + 1,
  brand: ['罗技', '戴尔', '华为', '小米', '索尼'][i % 5],
  main_image: `https://picsum.photos/seed/goods${i + 1}/200/200`,
  images: [],
  min_price: ((i % 10) + 1) * 10000,
  max_price: ((i % 10) + 3) * 12000,
  sales: (i + 1) * 7,
  status: i < 22 ? 1 : 0,
  created_at: new Date(2025, 3, i + 1).toISOString(),
}))

const orders: any[] = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  order_no: `ORD202505${String(i + 1).padStart(6, '0')}`,
  status: ['pending_payment', 'paid', 'shipped', 'received', 'completed', 'refunding'][i % 6],
  total_amount: ((i % 5) + 1) * 29900,
  pay_amount: ((i % 5) + 1) * 29900,
  freight_amount: i % 3 === 0 ? 0 : 1000,
  discount_amount: i % 4 === 0 ? 500 : 0,
  address_snapshot: { name: `收货人${i}`, phone: `1390000${String(i).padStart(4, '0')}`, full_address: `某省某市某区某路${i}号` },
  remark: i % 3 === 0 ? '加急发货' : '',
  user_id: (i % 5) + 1,
  username: `user${(i % 5) + 1}`,
  items: [{
    id: i * 2 + 1, sku_id: i + 1, spu_name: goods[i % goods.length]?.name || '商品',
    price: 29900, quantity: (i % 3) + 1, total_amount: ((i % 3) + 1) * 29900,
    main_image: goods[i % goods.length]?.main_image || '',
  }],
  created_at: new Date(2025, 4, 14 - i).toISOString(),
  paid_at: i < 16 ? new Date(2025, 4, 14 - i, 1).toISOString() : null,
  shipping_company: i < 12 ? ['顺丰速运', '中通快递', '圆通速递'][i % 3] : '',
  tracking_no: i < 12 ? `SF${Date.now() - i * 10000}` : '',
  shipped_at: i < 12 ? new Date(2025, 4, 15 - i).toISOString() : null,
  refund: i % 6 === 5 ? { refund_amount: 29900, reason: '商品质量问题', description: '收到后发现屏幕有坏点', status: 0, reject_reason: '' } : null,
}))

const logFiles = [
  { name: 'user-service.log', path: 'user/user-service.log', service: 'user', size_bytes: 245760, size_mb: 0.234, modified_at: new Date().toISOString() },
  { name: 'goods-service.log', path: 'goods/goods-service.log', service: 'goods', size_bytes: 512000, size_mb: 0.488, modified_at: new Date().toISOString() },
  { name: 'order-service.log', path: 'order/order-service.log', service: 'order', size_bytes: 1048576, size_mb: 1.0, modified_at: new Date().toISOString() },
  { name: 'sys-service.log', path: 'sys/sys-service.log', service: 'sys', size_bytes: 81920, size_mb: 0.078, modified_at: new Date().toISOString() },
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
        const match = req.url!.match(/^\/(\d+)\/status$/)
        if (!match || req.method !== 'PUT') return next()
        const id = parseInt(match[1])
        const body = await parseBody(req)
        const user = users.find(u => u.id === id)
        if (!user) { res.statusCode = 404; return json(res, {}) }
        user.status = body.status
        json(res, { msg: 'ok' })
      })

      // --- Goods management (admin operations only — list goes through real API) ---
      server.middlewares.use('/api/v1/goods/spu/', async (req, res, next) => {
        const statusMatch = req.url!.match(/^\/(\d+)\/status$/)
        const editMatch = req.url!.match(/^\/(\d+)$/)
        if (!statusMatch && !editMatch) return next()
        if (req.method !== 'PUT') return next()

        const id = parseInt((statusMatch || editMatch)![1])
        const body = await parseBody(req)
        const g = goods.find(g => g.id === id)
        if (!g) { res.statusCode = 404; return json(res, {}) }

        if (statusMatch) {
          g.status = body.status
        } else {
          Object.assign(g, body)
        }
        json(res, { msg: 'ok' })
      })

      // --- Order admin operations ---
      server.middlewares.use('/api/v1/order/admin/orders/', async (req, res, next) => {
        const refundMatch = req.url!.match(/^\/(\d+)\/refund$/)
        const shippingMatch = req.url!.match(/^\/(\d+)\/shipping$/)
        const remarkMatch = req.url!.match(/^\/(\d+)\/remark$/)
        if (!refundMatch && !shippingMatch && !remarkMatch) return next()

        const id = parseInt((refundMatch || shippingMatch || remarkMatch)![1])
        const body = await parseBody(req)
        const order = orders.find(o => o.id === id)
        if (!order) { res.statusCode = 404; return json(res, {}) }

        if (refundMatch) {
          if (order.refund) {
            if (body.action === 'approve') { order.refund.status = 1; order.status = 'refunded' }
            else { order.refund.status = -1; order.refund.reject_reason = body.reason || ''; order.status = 'completed' }
          }
        } else if (shippingMatch) {
          order.shipping_company = body.company
          order.tracking_no = body.tracking_no
          order.shipped_at = new Date().toISOString()
          order.status = 'shipped'
        } else if (remarkMatch) {
          order.remark = body.remark
        }
        json(res, { msg: 'ok' })
      })

      // --- Dashboard ---
      server.middlewares.use('/api/v1/sys/dashboard/overview', (_req, res) => {
        const today = new Date().toISOString().slice(0, 10)
        json(res, {
          total_goods: goods.length,
          total_users: users.length,
          total_orders: orders.length,
          today_orders: orders.filter(o => (o.created_at || '').startsWith(today)).length,
          pending_orders: orders.filter(o => o.status === 'pending_payment' || o.status === 'paid').length,
          total_revenue: orders
            .filter(o => ['paid', 'shipped', 'received', 'completed', 'refunding', 'refunded'].includes(o.status))
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
        const all = logLines(service || 'all', lines)
        json(res, {
          service: service || 'all', file: `${service || 'all'}-service.log`,
          lines: all, total_lines: 10000, offset: 0, count: all.length,
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

      // --- Captcha (already works but provide fallback) ---
      server.middlewares.use('/api/v1/sys/common/captcha', (_req, res) => {
        json(res, { captcha_id: 'mock-captcha-id', captcha_image: 'data:image/svg+xml;base64,' })
      })
    },
  }
}
