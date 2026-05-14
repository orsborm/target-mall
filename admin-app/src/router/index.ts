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
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to, _from, next) => {
  const store = useAdminStore()
  document.title = `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE || 'H5靶机后台'}`
  if (to.meta.auth && !store.isLoggedIn) {
    ElMessage.warning('请先登录')
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta.guest && store.isLoggedIn) {
    next({ name: 'dashboard' })
    return
  }
  next()
})

export default router
