import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() { return { top: 0 } },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/login/LoginView.vue'), meta: { title: '管理员登录', guest: true } },
    { path: '/', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '仪表盘', auth: true } },
    { path: '/goods', name: 'goods', component: () => import('@/views/goods/GoodsManage.vue'), meta: { title: '商品管理', auth: true } },
    { path: '/users', name: 'users', component: () => import('@/views/users/UsersManage.vue'), meta: { title: '用户管理', auth: true } },
    { path: '/orders', name: 'orders', component: () => import('@/views/orders/OrdersManage.vue'), meta: { title: '订单管理', auth: true } },
    { path: '/logs', name: 'logs', component: () => import('@/views/logs/LogsView.vue'), meta: { title: '日志管理', auth: true } },
    { path: '/banners', name: 'banners', component: () => import('@/views/marketing/BannerManage.vue'), meta: { title: '轮播图管理', auth: true } },
    { path: '/coupons', name: 'coupons', component: () => import('@/views/marketing/CouponManage.vue'), meta: { title: '优惠券管理', auth: true } },
    { path: '/comments', name: 'comments', component: () => import('@/views/goods/CommentsManage.vue'), meta: { title: '评论管理', auth: true } },
    { path: '/feedbacks', name: 'feedbacks', component: () => import('@/views/feedback/FeedbackManage.vue'), meta: { title: '反馈管理', auth: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/system/NotFoundView.vue'), meta: { title: '页面未找到' } },
  ],
})

router.beforeEach((to, _from, next) => {
  const store = useAdminStore()
  // Run auth checks BEFORE setting title, so redirects don't leak page titles
  if (to.meta.auth && !store.isLoggedIn) {
    ElMessage.warning('请先登录')
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta.guest && store.isLoggedIn) {
    next({ name: 'dashboard' })
    return
  }
  document.title = `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE || 'H5靶机后台'}`
  next()
})

export default router
