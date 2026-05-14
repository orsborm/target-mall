<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getDashboardOverview } from '@/api/goods-mgmt'
import { formatPrice } from '@/utils/format'
import { Goods, User, Document, ShoppingCart } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const stats = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    stats.value = await getDashboardOverview()
  } catch { ElMessage.warning('加载仪表盘数据失败') } finally { loading.value = false }
})
</script>

<template>
  <AdminLayout>
    <div v-loading="loading">
      <h2 style="margin-bottom:20px">仪表盘</h2>
      <el-row :gutter="16">
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">商品总数</div><div style="font-size:26px;font-weight:700;margin-top:6px">{{ stats?.total_goods ?? '-' }}</div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">用户总数</div><div style="font-size:26px;font-weight:700;margin-top:6px;color:#409eff">{{ stats?.total_users ?? '-' }}</div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">订单总数</div><div style="font-size:26px;font-weight:700;margin-top:6px">{{ stats?.total_orders ?? '-' }}</div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">今日订单</div><div style="font-size:26px;font-weight:700;margin-top:6px;color:#67c23a">{{ stats?.today_orders ?? '-' }}</div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">待处理订单</div><div style="font-size:26px;font-weight:700;margin-top:6px;color:#e6a23c">{{ stats?.pending_orders ?? '-' }}</div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div style="font-size:12px;color:#909399">总营收</div><div style="font-size:26px;font-weight:700;margin-top:6px;color:#f56c6c">&yen;{{ stats?.total_revenue ? formatPrice(stats.total_revenue) : '-' }}</div></el-card>
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
