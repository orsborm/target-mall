<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderDetail, cancelOrder, confirmReceipt, payOrder, requestRefund } from '@/api/order'
import type { OrderInfo } from '@/api/order'
import { ORDER_STATUS_MAP } from '@/api/order'
import { formatPrice, formatDate } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()

const order = ref<OrderInfo | null>(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

async function loadOrder() {
  error.value = ''; loading.value = true
  try {
    const id = Number(route.params.id)
    order.value = await getOrderDetail(id)
  } catch {
    error.value = '加载订单失败，请重试'
  } finally { loading.value = false }
}
onMounted(loadOrder)

async function handleCancel() {
  if (!order.value) return
  try { await ElMessageBox.confirm('确定取消该订单吗？', '提示', { type: 'warning' }) } catch { return }
  actionLoading.value = true
  try { await cancelOrder(order.value.id); ElMessage.success('订单已取消'); order.value.status = 'cancelled' } catch { /* ignore */ } finally { actionLoading.value = false }
}
async function handleConfirm() {
  if (!order.value) return
  actionLoading.value = true
  try { await confirmReceipt(order.value.id); ElMessage.success('已确认收货'); order.value.status = 'received' } catch { /* ignore */ } finally { actionLoading.value = false }
}
async function handlePay() {
  if (!order.value) return
  actionLoading.value = true
  try { const res = await payOrder(order.value.order_no); if (res.pay_url) { ElMessage.success('模拟支付成功'); order.value.status = 'paid' } } catch { /* ignore */ } finally { actionLoading.value = false }
}
async function handleRefund() {
  if (!order.value) return
  try { await ElMessageBox.confirm('确定申请退款吗？', '申请退款', { type: 'warning' }) } catch { return }
  actionLoading.value = true
  try {
    await requestRefund(order.value.id)
    ElMessage.success('退款申请已提交')
    order.value.status = 'refunding'
  } catch { /* interceptor handles */ } finally { actionLoading.value = false }
}
</script>

<template>
  <div class="order-detail-page">
    <div class="page-header">
      <h2>订单详情</h2>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <div v-loading="loading">
      <el-result v-if="error" icon="error" :title="error">
        <template #extra><el-button type="primary" @click="loadOrder">重试</el-button></template>
      </el-result>
      <template v-else-if="order">
        <div class="od-status-bar">
          <el-tag :type="ORDER_STATUS_MAP[order.status]?.type as any" size="large">{{ ORDER_STATUS_MAP[order.status]?.text }}</el-tag>
          <span class="od-no">订单号: {{ order.order_no }}</span>
          <span>创建时间: {{ formatDate(order.created_at) }}</span>
        </div>

        <div class="od-grid">
          <div class="od-main">
            <div class="od-section">
              <h3>商品信息</h3>
              <table class="od-table">
                <tbody>
                  <tr v-for="item in order.items" :key="item.id">
                    <td>{{ item.spu_name }}</td>
                    <td>&yen;{{ formatPrice(item.price) }}</td>
                    <td>x{{ item.quantity }}</td>
                    <td>&yen;{{ formatPrice(item.price * item.quantity) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="od-section">
              <h3>收货信息</h3>
              <div class="od-addr">
                <p><strong>{{ order.address_snapshot.name }}</strong> {{ order.address_snapshot.phone }}</p>
                <p>{{ order.address_snapshot.full_address }}</p>
              </div>
            </div>
          </div>
          <div class="od-sidebar">
            <div class="od-summary">
              <h3>金额信息</h3>
              <div class="od-summary__row"><span>商品总额</span><span>&yen;{{ formatPrice(order.total_amount) }}</span></div>
              <div class="od-summary__row"><span>运费</span><span>&yen;{{ formatPrice(order.freight_amount) }}</span></div>
              <div class="od-summary__row od-summary__total"><span>实付金额</span><span class="price price-lg">&yen;{{ formatPrice(order.pay_amount) }}</span></div>
            </div>
            <!-- Refund Flow -->
            <div class="od-section" v-if="order.status === 'refunding'">
              <h3>退款进度</h3>
              <el-steps :active="1" finish-status="success" style="margin:16px 0">
                <el-step title="提交申请" description="已提交退款申请" />
                <el-step title="商家审核" description="等待商家审核中" />
                <el-step title="退款到账" description="预计3-7个工作日" />
              </el-steps>
            </div>
            <div class="od-section" v-if="order.status === 'refunded'">
              <h3>退款进度</h3>
              <el-steps :active="3" finish-status="success" style="margin:16px 0">
                <el-step title="提交申请" description="已提交退款申请" />
                <el-step title="商家审核" description="审核已通过" />
                <el-step title="退款到账" description="退款已到账" />
              </el-steps>
            </div>

            <div class="od-actions" v-if="['pending_payment','paid','shipped','received'].includes(order.status)">
              <el-button v-if="order.status === 'pending_payment'" type="danger" @click="handlePay" :loading="actionLoading" style="width:100%">去支付</el-button>
              <el-button v-if="order.status === 'pending_payment'" @click="handleCancel" :loading="actionLoading" style="width:100%;margin-top:8px">取消订单</el-button>
              <el-button v-if="order.status === 'shipped'" type="primary" @click="handleConfirm" :loading="actionLoading" style="width:100%">确认收货</el-button>
              <el-button v-if="['paid','shipped','received'].includes(order.status)" type="warning" @click="handleRefund" :loading="actionLoading" style="width:100%;margin-top:8px">申请退款</el-button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.order-detail-page { max-width: 1200px; margin: 0 auto; }
.od-status-bar { display: flex; align-items: center; gap: 20px; background: #fff; padding: 14px 20px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #666; }
.od-no { color: #333; font-weight: 500; }
.od-grid { display: flex; gap: 20px; }
.od-main { flex: 1; }
.od-section { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 16px; }
.od-section h3 { font-size: 15px; margin: 0 0 12px; }
.od-table { width: 100%; border-collapse: collapse; }
.od-table td { padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
.od-addr { font-size: 14px; color: #333; }
.od-addr p { margin: 0 0 4px; }
.od-sidebar { width: 280px; flex-shrink: 0; }
.od-summary { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 16px; }
.od-summary h3 { font-size: 15px; margin: 0 0 12px; }
.od-summary__row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
.od-summary__total { border-top: 1px solid #f5f5f5; margin-top: 4px; padding-top: 12px; font-weight: 600; }
.od-actions { background: #fff; padding: 16px 20px; border-radius: 8px; }
</style>
