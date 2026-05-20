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
import { getAllNotifications, createNotification, deleteAdminNotification } from '../../shared/mock/notification-store'
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

// ---- Captcha store: captcha_id → code mapping ----
const captchaStore = new Map<string, string>()
function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

const logFiles = [
  { name: 'user-service.log', path: 'user/user-service.log', service: 'user', size: 245760, size_bytes: 245760, size_mb: 0.234, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'goods-service.log', path: 'goods/goods-service.log', service: 'goods', size: 512000, size_bytes: 512000, size_mb: 0.488, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'order-service.log', path: 'order/order-service.log', service: 'order', size: 1048576, size_bytes: 1048576, size_mb: 1.0, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
  { name: 'sys-service.log', path: 'sys/sys-service.log', service: 'sys', size: 81920, size_bytes: 81920, size_mb: 0.078, modified: new Date().toISOString(), modified_at: new Date().toISOString() },
]

// ---- Realistic mock logs with Chinese/English messages ----
const LOG_TEMPLATES: Record<string, { level: string; messages: string[] }[]> = {
  user: [
    { level: 'INFO', messages: [
      'User service starting on port 8001',
      'Database connection pool initialized (max=20, idle_timeout=30s)',
      'Redis cache connected successfully at redis://localhost:6379',
      'JWT signing key loaded from config',
      'Registered 12 API routes in 34ms',
      'User login successful: username=admin, ip=192.168.1.100',
      '用户 admin 登录成功，IP: 192.168.1.100',
      'User register: username=testuser1, email=test@example.com',
      '新用户注册: testuser1',
      'Profile updated for user_id=5',
      '用户 ID=5 修改了个人信息',
      'Password changed for user_id=3',
      '用户 ID=3 修改了密码',
      'Token refreshed for user_id=1, expires_in=7200s',
      'Address added: user_id=2, province=广东省, city=深圳市',
      '用户 ID=2 新增收货地址: 广东省深圳市',
      'Address deleted: id=12, user_id=2',
      'Logout: user_id=5, session cleared',
    ]},
    { level: 'WARN', messages: [
      'Login failed: username=root, ip=10.0.0.55, reason=密码错误 (attempt 3/5)',
      '登录失败: 用户名 root，IP 10.0.0.55，密码错误，剩余尝试 2 次',
      'Login lock triggered for IP 10.0.0.55 after 8 failed attempts',
      'IP 10.0.0.55 登录尝试超过阈值，已锁定 15 分钟',
      'Token near expiry for user_id=7, ttl=120s',
      'Refresh token expired for user_id=12, forcing re-login',
      'Redis connection pool running low: 18/20 connections active',
    ]},
    { level: 'ERROR', messages: [
      'Failed to hash password: unexpected algorithm error',
      '密码加密失败，算法异常',
      'Database connection lost, retrying in 3s... (attempt 1/5)',
      '数据库连接丢失，3秒后重试 (第1次)',
      'JWT verification failed: token signature invalid for user_id=99',
      'JWT 验证失败: Token 签名无效',
      'Failed to send SMS verification code to 138****0001: gateway timeout',
    ]},
  ],
  goods: [
    { level: 'INFO', messages: [
      'Goods service starting on port 8002',
      'Category cache loaded: 5 top-level categories',
      '商品分类缓存已加载: 5个顶级分类',
      'Product index rebuilt in 1.2s (25 spu, 75 sku)',
      '商品索引重建完成 (25 SPU, 75 SKU)',
      'New product created: SPU0026 — 机械键盘 Pro',
      '新增商品: SPU0026 机械键盘 Pro',
      'Product updated: id=3, price range 30000-60000 → 32000-62000',
      '商品 ID=3 价格已更新',
      'Product soft-deleted: id=25 (status=-1)',
      '商品已下架: ID=25',
      'SKU stock updated: sku_id=100, 50 → 45 (sold 5)',
      'SKU 库存更新: SKU-100, 50→45',
      'Comment added: spu_id=1, rating=5, user_id=3',
      '新增商品评价: SPU-1, 评分5星',
    ]},
    { level: 'WARN', messages: [
      'Low stock alert: sku_id=105, stock=3 (threshold=5)',
      '库存预警: SKU-105 仅剩 3 件 (阈值 5)',
      'Stock depleted: sku_id=120, stock=0 — auto-hide from listing',
      'SKU-120 库存为0，已自动下架',
      'Image URL unreachable: https://picsum.photos/seed/goods99/200/200 (timeout 5s)',
      '商品图片加载超时: goods99',
      'Category cache miss for category_id=99, falling back to DB query',
    ]},
    { level: 'ERROR', messages: [
      'Failed to upload product image: disk quota exceeded',
      '商品图片上传失败: 磁盘配额已满',
      'Elasticsearch sync failed for SPU 15 — index inconsistent',
      '搜索引擎同步失败: SPU-15 索引不一致',
      'Bulk SKU update aborted: negative price detected for sku_id=130',
      '批量SKU更新中止: SKU-130 价格为负数',
    ]},
  ],
  order: [
    { level: 'INFO', messages: [
      'Order service starting on port 8003',
      'Order created: ORD20250519001, user_id=1, amount=29900, items=2',
      '新订单创建: ORD20250519001, 用户ID=1, 金额¥299.00',
      'Payment received: order_id=1001, method=wechat, pay_no=PAY20250519001',
      '支付成功: 订单#1001, 微信支付, 流水号 PAY20250519001',
      'Order shipped: id=1001, company=顺丰速运, tracking=SF1234567890',
      '订单已发货: #1001, 顺丰速运 SF1234567890',
      'Order confirmed received: id=1000',
      '订单已确认收货: #1000',
      'Refund requested: order_id=1003, amount=29900, reason=商品质量问题',
      '退款申请: 订单#1003, ¥299.00, 原因: 商品质量问题',
      'Refund approved: order_id=1003, refund_no=RF20250519001',
      '退款已通过: 订单#1003',
      'Cart cleared after order: user_id=1, 3 items removed',
      '购物车已清空: 用户ID=1, 移除3件商品',
    ]},
    { level: 'WARN', messages: [
      'Order expired: id=1005, status=pending_payment, timeout=30min',
      '订单已超时: #1005 未支付超过30分钟，自动取消',
      'Duplicate order_no risk: 2 concurrent createOrder calls within 1ms',
      'Shipping callback from 顺丰速运 delayed by 45s',
      '快递回调延迟: 顺丰速运 延迟45秒',
      'Refund amount exceeds order total: order_id=1008, refund=59900, paid=29900',
      '退款金额超过实付: 订单#1008',
    ]},
    { level: 'ERROR', messages: [
      'Payment gateway timeout: order_id=1006, retry exhausted (3/3)',
      '支付网关超时: 订单#1006, 重试已耗尽',
      'Order creation failed: inventory check — sku_id=99 out of stock',
      '订单创建失败: SKU-99 库存不足',
      'Coupon consumption failed after order creation: order=1007, coupon=45',
      '优惠券核销失败(订单已创建): 订单#1007, 优惠券#45',
    ]},
  ],
  sys: [
    { level: 'INFO', messages: [
      'System service starting on port 8005',
      'Scheduled task registered: clean_expired_tokens (interval=1h)',
      '定时任务已注册: 清理过期Token (每1小时)',
      'Scheduled task registered: rotate_logs (interval=24h)',
      '定时任务已注册: 日志轮转 (每24小时)',
      'Page config updated: home_banner_1, new URL set',
      '首页配置已更新: 轮播图1',
      'Captcha generated: id=cap_20250519_001, ttl=300s',
      '验证码已生成: cap_20250519_001',
      'Dashboard overview queried (cached)',
      '仪表盘数据查询 (缓存命中)',
      'Banner reorder: home page, 5 items re-sequenced',
      '轮播图排序: 首页, 5项已重新排列',
    ]},
    { level: 'WARN', messages: [
      'Disk usage approaching threshold: 78% (warning at 80%)',
      '磁盘使用率 78%，接近告警阈值 80%',
      'Log file user-service.log reached 100MB, rotation triggered',
      '日志文件超过100MB，已触发轮转',
      'Captcha generation rate limit hit for IP 10.0.0.88 (100/min)',
      'IP 10.0.0.88 验证码请求频率超限',
    ]},
    { level: 'ERROR', messages: [
      'Failed to send email notification: SMTP connection refused',
      '邮件通知发送失败: SMTP连接被拒绝',
      'Log cleanup task failed: permission denied on sys-service.log',
      '日志清理失败: 权限不足',
      'Config file corruption detected — restored from backup',
      '配置文件损坏，已从备份恢复',
    ]},
  ],
}

function generateLogs(service: string, totalLines: number): string[] {
  // When 'all', interleave logs from every service
  const services = service === 'all' ? ['user', 'goods', 'order', 'sys'] : [service]
  const now = new Date()
  const result: string[] = []
  let globalIdx = 0
  while (result.length < totalLines) {
    for (const svc of services) {
      if (result.length >= totalLines) break
      const templates = LOG_TEMPLATES[svc] || LOG_TEMPLATES['sys']
      // Flatten templates into a flat pool for cycling
      const pool: { level: string; msg: string }[] = []
      for (const t of templates) for (const m of t.messages) pool.push({ level: t.level, msg: m })
      const entry = pool[globalIdx % pool.length]
      // Vary timestamps: ~2 min apart, most recent first
      const offsetMs = globalIdx * 131 * 1000
      const ts = new Date(now.getTime() - offsetMs)
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`
      const timeStr = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`
      result.push(`${dateStr} ${timeStr} [${entry.level}] ${svc} - ${entry.msg}`)
      globalIdx++
    }
  }
  return result
}

// ---- route handler ----

export function adminMockPlugin(): Plugin {
  return {
    name: 'admin-mock-api',
    configureServer(server) {
      // --- Auth (login) — must be BEFORE /api/v1/user/ so login
      //     requests aren't intercepted by the user-mgmt auth check ---
      server.middlewares.use('/api/v1/user/auth', async (req, res, next) => {
        const url = req.url!
        if ((url === '/login' || url === '/login/') && req.method === 'POST') {
          const body = await parseBody(req)
          if (body.captcha_id) {
            const stored = captchaStore.get(body.captcha_id)
            if (!stored) return json(res, { msg: '验证码已过期，请刷新重试' }, -1)
            if (stored !== String(body.captcha_code).trim()) return json(res, { msg: '验证码错误' }, -1)
            captchaStore.delete(body.captcha_id)
          }
          const username = (body.username || '').trim()
          if (!username) return json(res, { msg: '用户名不能为空' }, -1)
          return json(res, {
            access_token: 'admin-mock-token-' + Date.now(),
            refresh_token: 'admin-mock-refresh-' + Date.now(),
            expires_in: 7200,
            user_info: { id: 1, username: username, nickname: '管理员', avatar: '', role_code: 'admin', status: 1, created_at: new Date().toISOString() },
          })
        }
        next()
      })

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
        // req.url retains a leading '/' after Connect strips the mount prefix
        const listMatch = req.url!.match(/^\/orders\/list/)
        if (!listMatch || req.method !== 'GET') return next()
        const u = new URL(req.url!, 'http://localhost')
        const page = parseInt(u.searchParams.get('page') || '1')
        const pageSize = parseInt(u.searchParams.get('page_size') || '20')
        // uid=0 returns orders for ALL users (admin sentinel)
        const all = getSharedOrders(0, undefined, 1, 1000)
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
            const created = new Date(o.created_at || 0)
            const now = new Date()
            // Compare UTC dates to avoid timezone skew between server and client
            return created.getUTCFullYear() === now.getUTCFullYear()
              && created.getUTCMonth() === now.getUTCMonth()
              && created.getUTCDate() === now.getUTCDate()
          }).length,
          // Only unpaid orders count as "pending"; paid-but-unshipped is "to_ship"
          pending_orders: ordersList.filter(o => o.status === 'pending_payment').length,
          to_ship_orders: ordersList.filter(o => o.status === 'paid').length,
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
        // Use all services if none specified; generate enough to cover offset+lines
        const all = generateLogs(service || 'all', (lines + offset) * 3)
        const chunk = all.slice(offset, offset + lines)
        json(res, {
          service: service || 'all', file: `${service || 'all'}-service.log`,
          lines: chunk, total_lines: all.length, offset, count: chunk.length,
        })
      })

      server.middlewares.use('/api/v1/sys/log/search', (req, res) => {
        const url = new URL(req.url!, 'http://localhost')
        const keyword = url.searchParams.get('keyword') || ''
        const level = url.searchParams.get('level') || ''
        const matches = generateLogs('all', 400)
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
        const errs = generateLogs('all', 400).filter(l => l.includes('ERROR') || l.includes('WARN'))
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
      // Generates a random 4-digit code, stores it by captcha_id, and
      // returns an SVG image. The auth/login handler above validates the
      // submitted code against the store.
      server.middlewares.use('/api/v1/sys/common/captcha', (_req, res) => {
        const code = generateCode()
        const captchaId = 'mock-captcha-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
        captchaStore.set(captchaId, code)
        // Clean up expired entries (>5 min old) on each generation
        const now = Date.now()
        for (const [k] of captchaStore) {
          const ts = parseInt(k.split('-')[2]) || 0
          if (now - ts > 300_000) captchaStore.delete(k)
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">`
          + `<rect width="120" height="40" fill="#f0f0f0"/>`
          + `<text x="24" y="28" font-size="22" fill="#333" font-family="monospace">${code}</text>`
          + `<line x1="10" y1="33" x2="110" y2="23" stroke="#ccc"/>`
          + `<line x1="10" y1="24" x2="110" y2="20" stroke="#ccc"/>`
          + `</svg>`
        const b64 = Buffer.from(svg).toString('base64')
        json(res, {
          captcha_id: captchaId,
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

      // --- Notification management ---
      server.middlewares.use('/api/v1/msg/notifications', async (req, res, next) => {
        const url = req.url!
        const method = req.method!
        if (!['GET'].includes(method) && !checkAuth(req, res)) return

        if (url === '/list' || url.startsWith('/list?')) {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          const type = u.searchParams.get('type') || undefined
          return json(res, getAllNotifications(page, pageSize, type))
        }
        if ((url === '' || url === '/') && method === 'POST') {
          const body = await parseBody(req)
          if (!body.title?.trim()) { res.statusCode = 400; return json(res, { msg: '标题不能为空' }) }
          if (!body.content?.trim()) { res.statusCode = 400; return json(res, { msg: '内容不能为空' }) }
          const n = createNotification({
            user_id: body.user_id || 1, type: body.type || 'system',
            title: body.title.trim(), content: body.content.trim(),
            related_order_no: body.related_order_no,
          })
          return json(res, n)
        }
        const delMatch = url.match(/^\/(\d+)$/)
        if (delMatch && method === 'DELETE') {
          const ok = deleteAdminNotification(parseInt(delMatch[1]))
          if (!ok) { res.statusCode = 404; return json(res, {}) }
          return json(res, { msg: 'ok' })
        }
        next()
      })
    },
  }
}
