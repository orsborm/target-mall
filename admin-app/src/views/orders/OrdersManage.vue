<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import PaginationWrap from '@/components/PaginationWrap.vue'
import { getOrderList, processRefund, updateShipping, updateRemark, ORDER_STATUS_MAP } from '@/api/order-mgmt'
import type { AdminOrder } from '@/api/order-mgmt'
import { formatPrice, formatDate } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'

const orders = ref<AdminOrder[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const pageSize = 20
const activeStatus = ref('')
const searchKeyword = ref('')
const detailVisible = ref(false)
const currentOrder = ref<AdminOrder | null>(null)
const refunding = ref(false)
const shippingVisible = ref(false)
const shippingForm = ref({ company: '', tracking_no: '' })
const shippingLoading = ref(false)
const shippingOrderId = ref(0)
const remarkVisible = ref(false)
const remarkForm = ref({ id: 0, remark: '' })
const remarkLoading = ref(false)

function formatAddress(snapshot: { name: string; phone: string; full_address: string } | string | null | undefined): { name: string; phone: string; full_address: string } {
  if (!snapshot) return { name: '-', phone: '', full_address: '-' }
  if (typeof snapshot === 'string') {
    try { const parsed = JSON.parse(snapshot); return { name: parsed.name || '-', phone: parsed.phone || '', full_address: parsed.full_address || snapshot } } catch { return { name: '-', phone: '', full_address: snapshot } }
  }
  return snapshot
}

function openRemark(order: AdminOrder) {
  remarkForm.value = { id: order.id, remark: order.remark || '' }
  remarkVisible.value = true
}
async function handleRemark() {
  remarkLoading.value = true
  try {
    await updateRemark(remarkForm.value.id, remarkForm.value.remark.trim())
    const order = orders.value.find(o => o.id === remarkForm.value.id)
    if (order) order.remark = remarkForm.value.remark.trim()
    if (currentOrder.value?.id === remarkForm.value.id) {
      currentOrder.value.remark = remarkForm.value.remark.trim()
    }
    ElMessage.success('备注已更新')
    remarkVisible.value = false
  } catch { ElMessage.error('更新失败') } finally { remarkLoading.value = false }
}

function openShipping(order: AdminOrder) {
  shippingOrderId.value = order.id
  shippingForm.value = { company: '', tracking_no: '' }
  shippingVisible.value = true
}
async function handleShipping() {
  if (!shippingForm.value.company.trim() || !shippingForm.value.tracking_no.trim()) {
    ElMessage.warning('请输入物流公司和快递单号'); return
  }
  if (shippingForm.value.tracking_no.trim().length < 3) { ElMessage.warning('快递单号至少3位'); return }
  try {
    await ElMessageBox.confirm(
      `确认发货？物流: ${shippingForm.value.company}, 单号: ${shippingForm.value.tracking_no}`,
      '确认发货', { type: 'warning', confirmButtonText: '确认发货' }
    )
  } catch { return }
  shippingLoading.value = true
  try {
    await updateShipping(shippingOrderId.value, shippingForm.value.company.trim(), shippingForm.value.tracking_no.trim())
    // 直接更新本地状态
    const order = orders.value.find(o => o.id === shippingOrderId.value)
    if (order) {
      order.status = 'shipped'
      order.shipping_company = shippingForm.value.company.trim()
      order.tracking_no = shippingForm.value.tracking_no.trim()
    }
    if (currentOrder.value?.id === shippingOrderId.value) {
      currentOrder.value.status = 'shipped'
      currentOrder.value.shipping_company = shippingForm.value.company.trim()
      currentOrder.value.tracking_no = shippingForm.value.tracking_no.trim()
    }
    ElMessage.success('发货成功')
    shippingVisible.value = false
  } catch { ElMessage.error('发货失败') } finally { shippingLoading.value = false }
}

async function handleRefund(action: 'approve' | 'reject') {
  if (!currentOrder.value) return
  const label = action === 'approve' ? '通过' : '拒绝'
  try { await ElMessageBox.confirm(`确定${label}该退款申请？`, '退款审核', { type: 'warning' }) } catch { return }
  refunding.value = true
  try {
    await processRefund(currentOrder.value.id, action)
    const newStatus = action === 'approve' ? 'refunded' : 'completed'
    // 更新本地状态
    currentOrder.value.status = newStatus
    if (currentOrder.value.refund) {
      currentOrder.value.refund.status = action === 'approve' ? 1 : -1
    }
    const order = orders.value.find(o => o.id === currentOrder.value!.id)
    if (order) {
      order.status = newStatus
      if (order.refund) order.refund.status = action === 'approve' ? 1 : -1
    }
    ElMessage.success(`退款已${label}`)
  } catch { ElMessage.error('操作失败') } finally { refunding.value = false }
}

const tabs = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待付款' },
  { key: 'paid', label: '已付款' },
  { key: 'shipped', label: '已发货' },
  { key: 'received', label: '已收货' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
  { key: 'refunding', label: '退款中' },
]

async function loadOrders() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, page_size: pageSize }
    if (activeStatus.value) params.status = activeStatus.value
    if (searchKeyword.value.trim()) params.keyword = searchKeyword.value.trim()
    const res = await getOrderList(params)
    orders.value = res.list; total.value = res.total
  } catch { ElMessage.error('加载订单失败') } finally { loading.value = false }
}

function changeStatus(s: string) { activeStatus.value = s; page.value = 1; loadOrders() }
function onSearch() { page.value = 1; loadOrders() }
function changePage(p: number) { page.value = p; loadOrders() }
function viewDetail(order: AdminOrder) { currentOrder.value = order; detailVisible.value = true }

onMounted(loadOrders)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>订单管理</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <el-input v-model="searchKeyword" placeholder="搜索订单号/用户名..." :prefix-icon="Search" clearable @keyup.enter="onSearch" @clear="onSearch" style="width:260px" size="default" />
        <el-button :icon="Refresh" @click="loadOrders" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-radio-group v-model="activeStatus" size="small" @change="changeStatus" style="margin-bottom:14px">
      <el-radio-button v-for="t in tabs" :key="t.key" :value="t.key">{{ t.label }}</el-radio-button>
    </el-radio-group>

    <el-table :data="orders" v-loading="loading" stripe>
      <el-table-column prop="order_no" label="订单号" width="180" />
      <el-table-column prop="username" label="用户" width="120" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="ORDER_STATUS_MAP[row.status]?.type || 'info'" size="small">
            {{ ORDER_STATUS_MAP[row.status]?.text || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="110" align="right">
        <template #default="{ row }"><span class="price">&yen;{{ formatPrice(row.pay_amount) }}</span></template>
      </el-table-column>
      <el-table-column label="商品" min-width="200">
        <template #default="{ row }">
          <span v-for="(item, i) in row.items.slice(0, 3)" :key="i">
            {{ item.spu_name }} x{{ item.quantity }}<span v-if="i < Math.min(row.items.length, 3) - 1">, </span>
          </span>
          <span v-if="row.items.length > 3" style="color:#999"> 等{{ row.items.length }}件</span>
        </template>
      </el-table-column>
      <el-table-column label="收货人" width="100">
        <template #default="{ row }">{{ formatAddress(row.address_snapshot).name || '-' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="备注" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="font-size:12px;color:#999;cursor:pointer" @click="openRemark(row)">{{ row.remark || '点击添加备注' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="物流" width="110">
        <template #default="{ row }">
          <span v-if="row.status === 'paid'" style="color:#409eff;cursor:pointer;font-size:13px" @click="openShipping(row)">点击发货</span>
          <span v-else-if="row.tracking_no" style="font-size:12px">{{ row.shipping_company }}<br/>{{ row.tracking_no }}<br/><span style="color:#409eff;cursor:pointer;font-size:11px" @click="openShipping(row)">修改物流</span></span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display:flex;justify-content:center;margin-top:16px" v-if="total > pageSize">
      <PaginationWrap :total="total" :page-size="pageSize" :page="page" @page-change="changePage" />
    </div>

    <el-empty v-if="!loading && orders.length === 0" description="暂无订单" />

    <!-- Detail Dialog -->
    <el-dialog v-model="detailVisible" title="订单详情" width="700px">
      <template v-if="currentOrder">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="ORDER_STATUS_MAP[currentOrder.status]?.type || 'info'" size="small">
              {{ ORDER_STATUS_MAP[currentOrder.status]?.text || currentOrder.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="用户">{{ currentOrder.username }} (ID:{{ currentOrder.user_id }})</el-descriptions-item>
          <el-descriptions-item label="实付金额"><span class="price">&yen;{{ formatPrice(currentOrder.pay_amount) }}</span></el-descriptions-item>
          <el-descriptions-item label="运费">&yen;{{ formatPrice(currentOrder.freight_amount) }}</el-descriptions-item>
          <el-descriptions-item label="优惠">&yen;{{ formatPrice(currentOrder.discount_amount) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentOrder.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="支付时间">{{ currentOrder.paid_at ? formatDate(currentOrder.paid_at) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="收货人">{{ formatAddress(currentOrder.address_snapshot).name }} {{ formatAddress(currentOrder.address_snapshot).phone }}</el-descriptions-item>
          <el-descriptions-item label="收货地址">{{ formatAddress(currentOrder.address_snapshot).full_address }}</el-descriptions-item>
          <el-descriptions-item label="物流公司">{{ currentOrder.shipping_company || '-' }}</el-descriptions-item>
          <el-descriptions-item label="快递单号">{{ currentOrder.tracking_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentOrder.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <!-- Refund Info -->
        <div v-if="currentOrder.refund" style="margin-top:16px;padding:14px;background:#fef0f0;border-radius:6px">
          <h4 style="margin:0 0 10px;color:#e6a23c">退款信息</h4>
          <div style="font-size:13px;color:#666;line-height:1.8">
            <div>退款金额: <b style="color:#f56c6c">&yen;{{ formatPrice(currentOrder.refund.refund_amount) }}</b></div>
            <div>退款原因: {{ currentOrder.refund.reason }}</div>
            <div v-if="currentOrder.refund.description">详细说明: {{ currentOrder.refund.description }}</div>
            <div>审核状态:
              <el-tag v-if="currentOrder.refund.status === 0" type="warning" size="small">待审核</el-tag>
              <el-tag v-else-if="currentOrder.refund.status === 1" type="success" size="small">已通过</el-tag>
              <el-tag v-else-if="currentOrder.refund.status === -1" type="danger" size="small">已拒绝</el-tag>
            </div>
            <div v-if="currentOrder.refund.reject_reason">拒绝原因: {{ currentOrder.refund.reject_reason }}</div>
          </div>
        </div>
        <h4 style="margin:16px 0 8px">商品明细</h4>
        <el-table :data="currentOrder.items" size="small">
          <el-table-column prop="spu_name" label="商品" />
          <el-table-column prop="price" label="单价" width="100"><template #default="{row}">&yen;{{ formatPrice(row.price) }}</template></el-table-column>
          <el-table-column prop="quantity" label="数量" width="60" />
          <el-table-column label="小计" width="100"><template #default="{row}">&yen;{{ formatPrice(row.total_amount) }}</template></el-table-column>
        </el-table>
        <div v-if="currentOrder.status === 'refunding'" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid #f0f0f0">
          <el-button type="danger" @click="handleRefund('reject')" :loading="refunding">拒绝退款</el-button>
          <el-button type="success" @click="handleRefund('approve')" :loading="refunding">通过退款</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Shipping Dialog -->
    <el-dialog v-model="shippingVisible" title="录入物流信息" width="440px">
      <el-form label-width="80px">
        <el-form-item label="物流公司">
          <el-select v-model="shippingForm.company" placeholder="选择物流公司" style="width:100%">
            <el-option label="顺丰速运" value="顺丰速运" />
            <el-option label="中通快递" value="中通快递" />
            <el-option label="圆通速递" value="圆通速递" />
            <el-option label="韵达快递" value="韵达快递" />
            <el-option label="邮政EMS" value="邮政EMS" />
            <el-option label="京东物流" value="京东物流" />
          </el-select>
        </el-form-item>
        <el-form-item label="快递单号">
          <el-input v-model="shippingForm.tracking_no" placeholder="请输入快递单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shippingVisible = false">取消</el-button>
        <el-button type="primary" :loading="shippingLoading" @click="handleShipping">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- Remark Dialog -->
    <el-dialog v-model="remarkVisible" title="编辑备注" width="460px">
      <el-input v-model="remarkForm.remark" type="textarea" :rows="4" placeholder="输入订单备注..." maxlength="500" show-word-limit />
      <template #footer>
        <el-button @click="remarkVisible = false">取消</el-button>
        <el-button type="primary" :loading="remarkLoading" @click="handleRemark">保存备注</el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>

<style scoped>
</style>
