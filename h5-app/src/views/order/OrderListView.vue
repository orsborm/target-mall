<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOrderList } from '@/api/order'
import type { OrderInfo, OrderStatus } from '@/api/order'
import { ORDER_STATUS_MAP } from '@/api/order'
import { formatPrice, formatDate } from '@/utils/format'

const router = useRouter()

const orders = ref<OrderInfo[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const activeTab = ref('all')
const pageSize = 10

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending_payment', label: '待付款' },
  { key: 'paid', label: '已付款' },
  { key: 'shipped', label: '已发货' },
  { key: 'received', label: '已收货' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

async function loadOrders(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; orders.value = [] }
  loading.value = true; error.value = ''
  try {
    const params: any = { page: page.value, page_size: pageSize }
    if (activeTab.value !== 'all') params.status = activeTab.value as OrderStatus
    const res = await getOrderList(params)
    if (reset) orders.value = res.list
    else orders.value.push(...res.list)
    total.value = res.total
  } catch { error.value = '加载订单失败，请重试' } finally {
    loading.value = false
  }
}

function changeTab(tab: string) { activeTab.value = tab; loadOrders(true) }
function changePage(p: number) { page.value = p; loadOrders(true) }

onMounted(() => loadOrders(true))
</script>

<template>
  <div class="order-list-page">
    <div class="page-header"><h2>我的订单</h2></div>

    <el-tabs v-model="activeTab" @tab-change="changeTab">
      <el-tab-pane v-for="t in tabs" :key="t.key" :name="t.key" :label="t.label" />
    </el-tabs>

    <div v-loading="loading">
      <el-result v-if="error" icon="error" :title="error">
        <template #extra><el-button type="primary" @click="loadOrders(true)">重试</el-button></template>
      </el-result>
      <el-empty v-else-if="!loading && orders.length === 0" description="暂无订单" />

      <div v-else class="order-cards">
        <div v-for="order in orders" :key="order.id" class="order-card" @click="$router.push(`/order/${order.id}`)">
          <div class="order-card__header">
            <span>订单号: {{ order.order_no }}</span>
            <el-tag :type="ORDER_STATUS_MAP[order.status]?.type || 'info'" size="small">
              {{ ORDER_STATUS_MAP[order.status]?.text || order.status }}
            </el-tag>
          </div>
          <div class="order-card__items">
            <div v-for="item in order.items" :key="item.id" class="order-item">
              <span>{{ item.spu_name }}</span>
              <span class="order-item__right">&yen;{{ formatPrice(item.price) }} x{{ item.quantity }}</span>
            </div>
          </div>
          <div class="order-card__footer">
            <span>{{ formatDate(order.created_at) }}</span>
            <span>共 {{ order.items.length }} 件，实付: <b class="price">&yen;{{ formatPrice(order.pay_amount) }}</b></span>
          </div>
        </div>
      </div>

      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="changePage" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-list-page { max-width: 1200px; margin: 0 auto; }
.order-cards { display: flex; flex-direction: column; gap: 12px; }
.order-card { background: #fff; border-radius: 8px; overflow: hidden; cursor: pointer; transition: box-shadow .2s; }
.order-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.08); }
.order-card__header { display: flex; justify-content: space-between; padding: 12px 16px; background: #fafafa; font-size: 13px; color: #666; }
.order-card__items { padding: 0 16px; }
.order-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
.order-item:last-child { border-bottom: none; }
.order-item__right { color: #999; font-size: 13px; }
.order-card__footer { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 12px; color: #999; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 20px; }
</style>
