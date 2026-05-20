/**
 * h5-app mock server — shares goods data with admin-app via JSON file store.
 * Handles goods, comments, favorites, and coupon endpoints.
 */
import type { Plugin } from 'vite'
import { getGoodsDetail, queryGoods, getCategories } from '../../shared/mock/goods-store'
import { json, paginated, enrichWithStock, parseBody } from '../../shared/mock/helpers'
import { getComments, addComment } from '../../shared/mock/comment-store'
import { getFavorites, toggleFavorite, removeFavorites } from '../../shared/mock/favorite-store'
import { getAvailableCoupons, getUserCoupons, claimCoupon } from '../../shared/mock/coupon-store'
import { getCart, addCartItem, updateCartQty, toggleCartChecked, toggleAllChecked, removeCartItemsFn, getCartCountFn } from '../../shared/mock/cart-store'
import { getPageConfigs as getPC } from '../../shared/mock/page-config-store'
import { getOrders, getOrderDetail, createOrder as createMockOrder, updateOrderStatus, payOrder as payMockOrder } from '../../shared/mock/order-store'
import { addFeedback } from '../../shared/mock/feedback-store'

// ---- Captcha store (shared by auth and captcha endpoints) ----
const captchaStore = new Map<string, string>()
function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function h5MockPlugin(): Plugin {
  return {
    name: 'h5-mock-api',
    configureServer(server) {
      // --- Auth (login/register) with captcha validation ---
      server.middlewares.use('/api/v1/user/auth', async (req, res, next) => {
        const url = req.url!
        if ((url === '/login' || url === '/login/') && req.method === 'POST') {
          const body = await parseBody(req)
          // Validate captcha
          if (body.captcha_id) {
            const stored = captchaStore.get(body.captcha_id)
            if (!stored) {
              return json(res, { msg: '验证码已过期，请刷新重试' }, -1)
            }
            if (stored !== String(body.captcha_code).trim()) {
              return json(res, { msg: '验证码错误' }, -1)
            }
            captchaStore.delete(body.captcha_id)
          }
          return json(res, {
            access_token: 'mock-token-' + Date.now(),
            refresh_token: 'mock-refresh-' + Date.now(),
            expires_in: 7200,
            user_info: { id: 1, username: body.username || 'testuser', nickname: '测试用户', avatar: '', phone: '13800000001', email: 'test@example.com', role_code: 'user', status: 1, created_at: new Date().toISOString() },
          })
        }
        if ((url === '/register' || url === '/register/') && req.method === 'POST') {
          return json(res, { id: 99, msg: 'ok' })
        }
        if ((url === '/refresh-token' || url === '/refresh-token/') && req.method === 'POST') {
          return json(res, { access_token: 'mock-token-' + Date.now(), expires_in: 7200 })
        }
        next()
      })

      // --- User profile stub ---
      server.middlewares.use('/api/v1/user/profile', async (req, res, next) => {
        const url = req.url!
        if ((url === '' || url === '/') && req.method === 'GET') {
          return json(res, { id: 1, username: 'testuser', nickname: '测试用户', avatar: '', phone: '13800000001', email: 'test@example.com', role_code: 'user', status: 1, created_at: new Date().toISOString() })
        }
        if ((url === '' || url === '/') && req.method === 'PUT') {
          return json(res, null)
        }
        if ((url === '/logout' || url === '/logout/') && req.method === 'POST') {
          return json(res, null)
        }
        next()
      })

      // --- Orders ---
      server.middlewares.use('/api/v1/order/orders', async (req, res, next) => {
        const url = req.url!
        const method = req.method!
        const body = method !== 'GET' ? await parseBody(req) : {}

        // POST /api/v1/order/orders/create
        if ((url === '/create' || url === '/create/') && method === 'POST') {
          // Build items from cart data (or from direct buy body)
          const items = (body.items || []).map((it: any) => ({
            sku_id: it.sku_id || 1, spu_name: it.spu_name || it.goods_title || '商品',
            price: it.price || 0, quantity: it.quantity || 1, main_image: it.main_image || it.goods_image || '',
          }))
          // If no items in body, create a default item from cart
          if (items.length === 0) {
            const cartItems = getCart(body.user_id || 1)
            const checked = cartItems.filter((ci: any) => ci.checked)
            for (const ci of checked) {
              items.push({ sku_id: ci.sku_id, spu_name: ci.spu_name, price: ci.price, quantity: ci.quantity, main_image: ci.main_image })
            }
          }
          const order = createMockOrder({
            user_id: body.user_id || 1,
            items,
            total_amount: items.reduce((s: number, it: any) => s + it.price * it.quantity, 0),
            freight_amount: body.freight_amount || 0,
            discount_amount: body.discount_amount || 0,
            address_snapshot: body.address_snapshot || { name: '收货人', phone: '13800000000', full_address: '默认地址' },
            remark: body.remark,
            coupon_id: body.coupon_id,
          })
          // Clear checked cart items after order
          const cartItems = getCart(body.user_id || 1)
          const checkedIds = cartItems.filter((ci: any) => ci.checked).map((ci: any) => ci.id)
          if (checkedIds.length > 0) removeCartItemsFn(body.user_id || 1, checkedIds)
          return json(res, { order_id: order.id, order_no: order.order_no })
        }

        // GET /api/v1/order/orders/list
        if ((url === '/list' || url.startsWith('/list?')) && method === 'GET') {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          const status = u.searchParams.get('status') || undefined
          const uid = Number(body.user_id) || Number(u.searchParams.get('user_id')) || 1
          return json(res, getOrders(uid, status, page, pageSize))
        }

        // GET /api/v1/order/orders/{id}
        const detailMatch = url.match(/^\/(\d+)$/)
        if (detailMatch && method === 'GET') {
          const order = getOrderDetail(parseInt(detailMatch[1]))
          if (!order) { res.statusCode = 404; return json(res, {}, 404, '订单不存在') }
          return json(res, order)
        }

        // PUT cancel/confirm
        if (detailMatch && method === 'PUT') {
          const orderId = parseInt(detailMatch[1])
          if (!getOrderDetail(orderId)) { res.statusCode = 404; return json(res, {}, 404, '订单不存在') }
          if (url.endsWith('/cancel')) { updateOrderStatus(orderId, 'cancelled') }
          else if (url.endsWith('/confirm')) { updateOrderStatus(orderId, 'received') }
          return json(res, { msg: 'ok' })
        }

        // POST refund
        if (url.includes('/refund') && method === 'POST') {
          return json(res, { refund_no: 'RF' + Date.now() })
        }

        next()
      })

      // --- Pay ---
      server.middlewares.use('/api/v1/order/pay', async (req, res, next) => {
        const url = req.url!
        if ((url === '' || url === '/') && req.method === 'POST') {
          const body = await parseBody(req)
          const result = payMockOrder(body.order_id)
          if (!result) { res.statusCode = 400; return json(res, {}, 400, '订单无法支付') }
          return json(res, result)
        }
        next()
      })

      // --- Address stubs ---
      server.middlewares.use('/api/v1/user/address', async (req, res, next) => {
        const url = req.url!
        if ((url === '' || url === '/') && req.method === 'GET') {
          return json(res, [{ id: 1, user_id: 1, name: '默认收货人', phone: '13800000001', province: '广东省', city: '深圳市', district: '南山区', detail: '科技园路1号', is_default: true, created_at: new Date().toISOString() }])
        }
        if ((url === '' || url === '/') && req.method === 'POST') {
          return json(res, { id: Date.now() })
        }
        const addrMatch = url.match(/^\/(\d+)$/)
        if (addrMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
          return json(res, null)
        }
        next()
      })

      // --- Goods SPU endpoints ---
      server.middlewares.use('/api/v1/goods/spu', (req, res, next) => {
        const url = req.url!
        const method = req.method!

        if (url === '/list' || url.startsWith('/list?')) {
          const u = new URL(url, 'http://localhost')
          const page = Math.max(1, parseInt(u.searchParams.get('page') || '1') || 1)
          const pageSize = Math.min(100, Math.max(1, parseInt(u.searchParams.get('page_size') || '20') || 20))
          const rawCat = u.searchParams.get('category_id')
          const categoryId = rawCat !== null && rawCat !== '' ? Number(rawCat) : undefined
          const list = queryGoods({
            status: 1,
            category_id: categoryId,
            keyword: u.searchParams.get('keyword') || undefined,
            sort: u.searchParams.get('sort') || undefined,
            min_price: (() => { const v = u.searchParams.get('min_price'); return v !== null ? parseFloat(v) : undefined })(),
            max_price: (() => { const v = u.searchParams.get('max_price'); return v !== null ? parseFloat(v) : undefined })(),
          })
          return json(res, paginated(enrichWithStock(list), page, pageSize))
        }

        if (url === '/recommend' || url.startsWith('/recommend?')) {
          const u = new URL(url, 'http://localhost')
          const pageSize = parseInt(u.searchParams.get('page_size') || '10')
          return json(res, queryGoods({ status: 1, sort: 'sales_desc' }).slice(0, pageSize))
        }

        // GET /api/v1/goods/spu/{id}/comments
        const commentsMatch = url.match(/^\/(\d+)\/comments$/)
        if (commentsMatch && method === 'GET') {
          const u = new URL(url, 'http://localhost')
          const page = parseInt(u.searchParams.get('page') || '1')
          const pageSize = parseInt(u.searchParams.get('page_size') || '20')
          return json(res, getComments(parseInt(commentsMatch[1]), page, pageSize))
        }

        const detailMatch = url.match(/^\/(\d+)$/)
        if (detailMatch && method === 'GET') {
          const id = parseInt(detailMatch[1])
          const detail = getGoodsDetail(id)
          if (!detail.spu) { res.statusCode = 404; return json(res, {}) }
          return json(res, detail)
        }

        next()
      })

      // --- Category tree ---
      server.middlewares.use('/api/v1/goods/category/tree', (_req, res) => {
        json(res, getCategories())
      })

      // --- Comments ---
      server.middlewares.use('/api/v1/goods/comment', async (req, res, next) => {
        if (req.method === 'POST' && (req.url === '' || req.url === '/')) {
          const body = await parseBody(req)
          if (!body.spu_id || !body.content) { res.statusCode = 400; return json(res, { msg: '缺少参数' }) }
          const c = addComment({ spu_id: body.spu_id, user_id: body.user_id || 1, username: body.username || '匿名用户', rating: body.rating || 5, content: body.content, images: body.images || [] })
          return json(res, c)
        }
        next()
      })

      // --- Favorites ---
      server.middlewares.use('/api/v1/user/favorites', (req, res) => {
        const u = new URL(req.url!, 'http://localhost')
        json(res, getFavorites(parseInt(u.searchParams.get('user_id') || '1')))
      })
      server.middlewares.use('/api/v1/user/favorite', async (req, res) => {
        const body = req.method === 'POST' ? await parseBody(req) : {}
        if (req.method === 'DELETE') {
          removeFavorites(body.user_id || 1, body.spu_ids || [])
          return json(res, { msg: 'ok' })
        }
        if (req.method === 'POST') {
          const result = toggleFavorite(body.user_id || 1, body.spu_id)
          return json(res, { favorited: result })
        }
        res.statusCode = 405; json(res, { msg: 'Method not allowed' })
      })

      // --- Cart ---
      server.middlewares.use('/api/v1/order/cart', async (req, res, next) => {
        const url = req.url!
        const method = req.method!
        const body = method !== 'GET' && method !== 'DELETE' ? await parseBody(req) : {}
        const userId = body.user_id || 1

        // GET /api/v1/order/cart/ — list cart (enriched)
        if ((url === '' || url === '/') && method === 'GET') {
          return json(res, getCart(userId))
        }
        // POST /api/v1/order/cart/ — add to cart
        if ((url === '' || url === '/') && method === 'POST') {
          const result = addCartItem(userId, body.sku_id, body.quantity || 1)
          if (!result) { res.statusCode = 400; return json(res, { msg: 'SKU不存在' }) }
          return json(res, { msg: 'ok' })
        }
        // DELETE /api/v1/order/cart/ — remove items
        if ((url === '' || url === '/') && method === 'DELETE') {
          removeCartItemsFn(userId, body.ids || [])
          return json(res, { msg: 'ok' })
        }
        // PUT /api/v1/order/cart/checked — toggle check
        if (url === '/checked' && method === 'PUT') {
          toggleCartChecked(userId, body.ids || [], body.checked)
          return json(res, { msg: 'ok' })
        }
        // PUT /api/v1/order/cart/check-all — toggle all
        if (url === '/check-all' && method === 'PUT') {
          toggleAllChecked(userId, body.checked)
          return json(res, { msg: 'ok' })
        }
        // PUT /api/v1/order/cart/{id} — update quantity
        const qtyMatch = url.match(/^\/(\d+)$/)
        if (qtyMatch && method === 'PUT') {
          const ok = updateCartQty(userId, parseInt(qtyMatch[1]), body.quantity)
          if (!ok) { res.statusCode = 404; return json(res, { msg: '购物车项不存在' }) }
          return json(res, { msg: 'ok' })
        }
        next()
      })

      // --- Coupons ---
      server.middlewares.use('/api/v1/sys/coupon/available', (_req, res) => {
        json(res, getAvailableCoupons())
      })
      server.middlewares.use('/api/v1/user/coupons', (req, res) => {
        const u = new URL(req.url!, 'http://localhost')
        json(res, getUserCoupons(parseInt(u.searchParams.get('user_id') || '1')))
      })
      server.middlewares.use('/api/v1/user/coupon/claim', async (req, res) => {
        const body = await parseBody(req)
        const ok = claimCoupon(body.user_id || 1, body.coupon_id)
        if (!ok) { res.statusCode = 400; return json(res, { msg: '领取失败' }) }
        json(res, { msg: 'ok' })
      })
      server.middlewares.use('/api/v1/user/coupon/calculate', async (req, res) => {
        const body = await parseBody(req)
        const { getCouponDiscount } = await import('../../shared/mock/coupon-store')
        const discount = getCouponDiscount(body.coupon_id, body.amount || 0)
        json(res, { discount, applicable: discount > 0 })
      })
      server.middlewares.use('/api/v1/user/coupon/use', async (req, res) => {
        const body = await parseBody(req)
        const { useCoupon } = await import('../../shared/mock/coupon-store')
        const ok = useCoupon(body.user_id || 1, body.coupon_id)
        if (!ok) { res.statusCode = 400; return json(res, { msg: '核销失败' }) }
        json(res, { msg: 'ok' })
      })

      // --- Page Configs (banners) ---
      server.middlewares.use('/api/v1/sys/page-config', (req, res) => {
        const match = req.url!.match(/^\/([a-z_]+)$/)
        if (match && req.method === 'GET') {
          // Return simplified format matching what h5 expects: { key, type, value, label }[]
          const configs = getPC(match[1]).map(c => ({ key: c.key, type: c.type, value: c.value, label: c.label, link: c.link || '' }))
          return json(res, configs)
        }
        res.statusCode = 404; json(res, {})
      })

      // --- Feedback ---
      server.middlewares.use('/api/v1/msg/feedback', async (req, res, next) => {
        if ((req.url === '' || req.url === '/') && req.method === 'POST') {
          const body = await parseBody(req)
          if (!body.content || !body.content.trim()) { res.statusCode = 400; return json(res, { msg: '内容不能为空' }) }
          const fb = addFeedback({ type: body.type || 'other', content: body.content.trim(), contact: body.contact || '', images: body.images || [] })
          return json(res, { id: fb.id })
        }
        next()
      })

      // --- Captcha ---
      // Stores a random 4-digit code keyed by captcha_id; the auth/login
      // handler above validates the submitted code against this store.
      server.middlewares.use('/api/v1/sys/common/captcha', (_req, res) => {
        const code = generateCode()
        const captchaId = 'mock-captcha-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
        captchaStore.set(captchaId, code)
        // Clean up expired entries (>5 min)
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
    },
  }
}
