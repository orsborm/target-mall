<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAddressList, createAddress, updateAddress, deleteAddress } from '@/api/user'
import type { Address, AddressParams } from '@/api/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete } from '@element-plus/icons-vue'

const addresses = ref<Address[]>([])
const loading = ref(false)
const error = ref('')
const showDialog = ref(false)
const editingId = ref(0)
const form = ref<AddressParams>({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false })
const saving = ref(false)

async function loadAddresses() {
  loading.value = true; error.value = ''
  try { addresses.value = await getAddressList() } catch { error.value = '加载地址失败，请重试' } finally { loading.value = false }
}

function openAdd() {
  editingId.value = 0
  form.value = { name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false }
  showDialog.value = true
}
function openEdit(addr: Address) {
  editingId.value = addr.id
  form.value = { name: addr.name, phone: addr.phone, province: addr.province, city: addr.city, district: addr.district, detail: addr.detail, is_default: addr.is_default }
  showDialog.value = true
}

async function handleSave() {
  const { name, phone, province, city, district, detail } = form.value
  if (!name.trim()) { ElMessage.warning('请输入收货人姓名'); return }
  if (!/^1[3-9]\d{9}$/.test(phone)) { ElMessage.warning('手机号格式不正确'); return }
  if (!province.trim() || !city.trim() || !district.trim()) { ElMessage.warning('请填写完整地区信息'); return }
  if (!detail.trim()) { ElMessage.warning('请输入详细地址'); return }
  saving.value = true
  try {
    if (editingId.value > 0) await updateAddress(editingId.value, form.value)
    else await createAddress(form.value)
    ElMessage.success('保存成功'); showDialog.value = false; loadAddresses()
  } catch { ElMessage.error('保存地址失败') } finally { saving.value = false }
}

async function handleDelete(id: number) {
  try { await ElMessageBox.confirm('确定删除该地址吗？', '提示', { type: 'warning' }) } catch { return }
  try { await deleteAddress(id); ElMessage.success('已删除'); loadAddresses() } catch { ElMessage.error('删除地址失败') }
}

onMounted(loadAddresses)
</script>

<template>
  <div class="address-page">
    <div class="page-header">
      <h2>收货地址</h2>
      <el-button type="primary" @click="openAdd">新增地址</el-button>
    </div>

    <el-result v-if="error" icon="error" :title="error">
      <template #extra><el-button type="primary" @click="loadAddresses">重试</el-button></template>
    </el-result>
    <el-empty v-else-if="!loading && addresses.length === 0" description="暂无收货地址" />

    <div v-else class="addr-grid" v-loading="loading">
      <div v-for="addr in addresses" :key="addr.id" class="addr-card">
        <div class="addr-card__header">
          <strong>{{ addr.name }}</strong>
          <span style="color:#999">{{ addr.phone }}</span>
          <el-tag v-if="addr.is_default" type="danger" size="small">默认</el-tag>
        </div>
        <div class="addr-card__detail">{{ addr.province }}{{ addr.city }}{{ addr.district }} {{ addr.detail }}</div>
        <div class="addr-card__actions">
          <el-button link type="primary" :icon="Edit" @click="openEdit(addr)">编辑</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(addr.id)">删除</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showDialog" :title="editingId ? '编辑地址' : '新增地址'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="收货人"><el-input v-model="form.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" placeholder="请输入手机号" /></el-form-item>
        <el-form-item label="省"><el-input v-model="form.province" placeholder="省份" /></el-form-item>
        <el-form-item label="市"><el-input v-model="form.city" placeholder="城市" /></el-form-item>
        <el-form-item label="区"><el-input v-model="form.district" placeholder="区县" /></el-form-item>
        <el-form-item label="详细地址"><el-input v-model="form.detail" placeholder="街道/门牌号" /></el-form-item>
        <el-form-item label="默认地址"><el-checkbox v-model="form.is_default">设为默认收货地址</el-checkbox></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.address-page { max-width: 1200px; margin: 0 auto; }
.addr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.addr-card { background: #fff; padding: 16px 20px; border-radius: 8px; }
.addr-card__header { display: flex; align-items: center; gap: 10px; font-size: 15px; }
.addr-card__detail { font-size: 13px; color: #666; margin-top: 8px; }
.addr-card__actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
