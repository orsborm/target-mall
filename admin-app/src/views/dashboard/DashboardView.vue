<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getGoodsList } from '@/api/goods-mgmt'
import request from '@/api/request'
import { formatPrice } from '@/utils/format'
import { Goods, User, Document, ShoppingCart } from '@element-plus/icons-vue'

const stats = ref({
  total_goods: null as number | null,
  total_users: null as number | null,
  total_orders: null as number | null,
  today_orders: null as number | null,
  pending_orders: null as number | null,
  total_revenue: null as number | null,
})
const loading = ref(true)

onMounted(async () => {
  const [goodsR, orderR] = await Promise.allSettled([
    getGoodsList({ page: 1, page_size: 1 }),
    request.get('/order/orders/list', { params: { page: 1, page_size: 1 } }),
  ])

  if (goodsR.status === 'fulfilled') {
    stats.value.total_goods = goodsR.value.total
  }
  if (orderR.status === 'fulfilled') {
    stats.value.total_orders = (orderR.value as any).total
  }
  // total_users / today_orders / pending_orders / total_revenue 需要后端聚合接口
  loading.value = false
})
</script>

<template>
  <AdminLayout>
    <div v-loading="loading">
      <h2 style="margin-bottom:20px">仪表盘</h2>
      <el-row :gutter="16">
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">商品总数</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px">{{ stats.total_goods ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">用户总数</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px;color:#409eff">{{ stats.total_users ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">订单总数</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px">{{ stats.total_orders ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">今日订单</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px;color:#67c23a">{{ stats.today_orders ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">待处理订单</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px;color:#e6a23c">{{ stats.pending_orders ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover">
            <div style="font-size:12px;color:#909399">总营收</div>
            <div style="font-size:26px;font-weight:700;margin-top:6px;color:#f56c6c">{{ stats.total_revenue != null ? '&yen;' + formatPrice(stats.total_revenue) : '-' }}</div>
          </el-card>
        </el-col>
      </el-row>

      <el-card style="margin-top:20px">
        <template #header>快捷操作</template>
        <el-row :gutter="12">
          <el-col :span="6"><el-button :icon="Goods" @click="$router.push('/goods')" style="width:100%">商品管理</el-button></el-col>
          <el-col :span="6"><el-button :icon="User" @click="$router.push('/users')" style="width:100%">用户管理</el-button></el-col>
          <el-col :span="6"><el-button :icon="Document" @click="$router.push('/logs')" style="width:100%">日志管理</el-button></el-col>
          <el-col :span="6"><el-button :icon="ShoppingCart" @click="$router.push('/orders')" style="width:100%">订单管理</el-button></el-col>
        </el-row>
      </el-card>
    </div>
  </AdminLayout>
</template>
