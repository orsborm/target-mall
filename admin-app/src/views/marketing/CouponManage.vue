<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getCouponList, createCoupon, updateCoupon, deleteCoupon, toggleCouponStatus } from '@/api/coupon-mgmt'
import type { CouponTemplate } from '@/api/coupon-mgmt'
import { ElMessage } from 'element-plus'
import { Refresh, Plus, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const coupons = ref<CouponTemplate[]>([])
const loading = ref(false)
const showDialog = ref(false)
const saving = ref(false)
const editing = ref(false)
const form = ref({
  id: 0, name: '', type: 'fixed' as 'fixed' | 'percent',
  threshold: 0, value: 10,
  total_qty: 100, start_time: '', end_time: '', status: 1,
})

function openCreate() {
  editing.value = false
  const now = new Date()
  form.value = { id: 0, name: '', type: 'fixed', threshold: 0, value: 10, total_qty: 100, start_time: now.toISOString().slice(0, 16), end_time: new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 16), status: 1 }
  showDialog.value = true
}
function openEdit(row: CouponTemplate) {
  editing.value = true
  form.value = { id: row.id, name: row.name, type: row.type, threshold: row.type === 'fixed' ? +(row.threshold / 100).toFixed(2) : row.threshold, value: row.type === 'fixed' ? +(row.value / 100).toFixed(2) : row.value, total_qty: row.total_qty, start_time: row.start_time?.slice(0, 16), end_time: row.end_time?.slice(0, 16), status: row.status }
  showDialog.value = true
}

async function loadCoupons() {
  loading.value = true
  try { coupons.value = await getCouponList() } catch { ElMessage.error('加载优惠券失败') } finally { loading.value = false }
}

async function handleDelete(row: CouponTemplate) {
  try { await ElMessageBox.confirm(`确定删除优惠券「${row.name}」？`, '确认删除', { type: 'error', confirmButtonText: '确定删除' }) } catch { return }
  try { await deleteCoupon(row.id); ElMessage.success('已删除'); loadCoupons() } catch { ElMessage.error('删除失败') }
}
async function handleToggle(row: CouponTemplate) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 0 ? '停用' : '启用'
  try { await ElMessageBox.confirm(`确定${action}优惠券「${row.name}」？`, '确认操作', { type: 'warning' }) } catch { return }
  try { await toggleCouponStatus(row.id, newStatus); row.status = newStatus; ElMessage.success(`${action}成功`) } catch { ElMessage.error(`${action}失败`) }
}

async function handleSave() {
  if (!form.value.name.trim()) { ElMessage.warning('请输入优惠券名称'); return }
  if (new Date(form.value.end_time) <= new Date(form.value.start_time)) { ElMessage.warning('结束时间必须在开始时间之后'); return }
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      name: form.value.name, type: form.value.type,
      threshold: Math.round(form.value.threshold * 100),
      value: form.value.type === 'fixed' ? Math.round(form.value.value * 100) : form.value.value,
      total_qty: form.value.total_qty,
      start_time: new Date(form.value.start_time).toISOString(),
      end_time: new Date(form.value.end_time).toISOString(),
      status: form.value.status,
    }
    if (editing.value) {
      await updateCoupon(form.value.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createCoupon(payload)
      ElMessage.success('创建成功')
    }
    showDialog.value = false; loadCoupons()
  } catch { ElMessage.error(editing.value ? '更新失败' : '创建失败') } finally { saving.value = false }
}

onMounted(loadCoupons)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>优惠券管理</h2>
      <div style="display:flex;gap:8px">
        <el-button type="primary" :icon="Plus" @click="openCreate">创建优惠券</el-button>
        <el-button :icon="Refresh" @click="loadCoupons" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-table :data="coupons" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">{{ row.type === 'fixed' ? '满减' : '折扣' }}</template>
      </el-table-column>
      <el-table-column label="门槛/值" width="130">
        <template #default="{ row }">
          {{ row.type === 'fixed' ? `满¥${(row.threshold / 100).toFixed(0)} 减¥${(row.value / 100).toFixed(0)}` : `${(row.value / 10).toFixed(1)}折` }}
        </template>
      </el-table-column>
      <el-table-column label="发放/总量" width="100">
        <template #default="{ row }">{{ row.used_qty }} / {{ row.total_qty }}</template>
      </el-table-column>
      <el-table-column label="有效期" width="200">
        <template #default="{ row }">{{ row.start_time?.slice(0, 10) }} ~ {{ row.end_time?.slice(0, 10) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggle(row)">
            {{ row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && coupons.length === 0" description="暂无优惠券" />

    <el-dialog v-model="showDialog" :title="editing ? '编辑优惠券' : '创建优惠券'" width="500px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="如: 双11满减券" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="fixed">满减券</el-radio>
            <el-radio value="percent">折扣券</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="form.type === 'fixed' ? '满减门槛(元)' : '折扣率'">
          <template v-if="form.type === 'fixed'">
            <el-input-number v-model="form.threshold" :min="0" :step="10" style="width:160px" /> 元
            <span style="margin:0 8px">减</span>
            <el-input-number v-model="form.value" :min="1" :step="5" style="width:140px" /> 元
          </template>
          <template v-else>
            <el-input-number v-model="form.value" :min="1" :max="99" :step="5" style="width:140px" />
            <span style="margin-left:4px">({{ (form.value / 10).toFixed(1) }} 折)</span>
          </template>
        </el-form-item>
        <el-form-item label="发放总量"><el-input-number v-model="form.total_qty" :min="1" :step="10" style="width:160px" /></el-form-item>
        <el-form-item label="开始时间"><el-input v-model="form.start_time" type="datetime-local" /></el-form-item>
        <el-form-item label="结束时间"><el-input v-model="form.end_time" type="datetime-local" /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>
