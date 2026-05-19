import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() { return { top: 0 } },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录', guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { title: '注册', guest: true },
    },
    {
      path: '/goods/list',
      name: 'goods-list',
      component: () => import('@/views/goods/GoodsListView.vue'),
      meta: { title: '商品列表' },
    },
    {
      path: '/goods/:id',
      name: 'goods-detail',
      component: () => import('@/views/goods/GoodsDetailView.vue'),
      meta: { title: '商品详情' },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/order/CartView.vue'),
      meta: { title: '购物车', auth: true },
    },
    {
      path: '/order/confirm',
      name: 'order-confirm',
      component: () => import('@/views/order/OrderConfirmView.vue'),
      meta: { title: '确认订单', auth: true },
    },
    {
      path: '/order/list',
      name: 'order-list',
      component: () => import('@/views/order/OrderListView.vue'),
      meta: { title: '我的订单', auth: true },
    },
    {
      path: '/order/:id',
      name: 'order-detail',
      component: () => import('@/views/order/OrderDetailView.vue'),
      meta: { title: '订单详情', auth: true },
    },
    {
      path: '/user/profile',
      name: 'user-profile',
      component: () => import('@/views/user/ProfileView.vue'),
      meta: { title: '个人中心', auth: true },
    },
    {
      path: '/user/address',
      name: 'user-address',
      component: () => import('@/views/user/AddressView.vue'),
      meta: { title: '收货地址', auth: true },
    },
    {
      path: '/user/notifications',
      name: 'user-notifications',
      component: () => import('@/views/user/NotificationView.vue'),
      meta: { title: '消息通知', auth: true },
    },
    {
      path: '/user/coupons',
      name: 'user-coupons',
      component: () => import('@/views/user/CouponCenterView.vue'),
      meta: { title: '领券中心', auth: true },
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/feedback/FeedbackView.vue'),
      meta: { title: '意见反馈', auth: true },
    },
    {
      path: '/system/logs',
      name: 'system-logs',
      component: () => import('@/views/system/LogView.vue'),
      meta: { title: '日志管理', auth: true, role: 'super_admin' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/system/NotFoundView.vue'),
      meta: { title: '页面未找到' },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()

  // Run auth checks BEFORE setting title, so redirects don't leak page titles
  if (to.meta.auth && !userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.role && userStore.userInfo?.role_code !== to.meta.role) {
    ElMessage.error('无权访问此页面')
    next({ name: 'home' })
    return
  }

  if (to.meta.guest && userStore.isLoggedIn) {
    next({ name: 'home' })
    return
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE || 'H5靶机商城'}`
  }
  next()
})

export default router
