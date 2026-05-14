<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getGoodsList, updateGoodsStatus, updateGoods } from '@/api/goods-mgmt'
import type { GoodsItem } from '@/api/goods-mgmt'
import { formatPrice, formatDate } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Edit } from '@element-plus/icons-vue'

const goods = ref<GoodsItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const pageSize = 20
const editVisible = ref(false)
const editingGoods = reactive<Partial<GoodsItem>>({})
const editingId = ref(0)
const saving = ref(false)

async function loadGoods() {
  loading.value = true
  try {
    const res = await getGoodsList({ page: page.value, page_size: pageSize })
    goods.value = res.list; total.value = res.total
  } catch { ElMessage.error('加载商品失败') } finally { loading.value = false }
}

async function toggleStatus(row: GoodsItem) {
  const action = row.status === 1 ? '下架' : '上架'
  try { await ElMessageBox.confirm(`确定${action}商品「${row.name}」？`, '确认操作', { type: 'warning' }) } catch { return }
  try {
    await updateGoodsStatus(row.id, row.status === 1 ? 0 : 1)
    row.status = row.status === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch { ElMessage.error(`${action}失败`) }
}

function openEdit(row: GoodsItem) {
  editingId.value = row.id
  editingGoods.name = row.name
  editingGoods.subtitle = row.subtitle
  editingGoods.brand = row.brand
  editingGoods.main_image = row.main_image
  editingGoods.min_price = row.min_price
  editingGoods.max_price = row.max_price
  editVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    await updateGoods(editingId.value, {
      name: editingGoods.name, subtitle: editingGoods.subtitle,
      brand: editingGoods.brand, main_image: editingGoods.main_image,
      min_price: editingGoods.min_price, max_price: editingGoods.max_price,
    })
    ElMessage.success('商品更新成功')
    editVisible.value = false
    loadGoods()
  } catch { ElMessage.error('更新失败') } finally { saving.value = false }
}

function changePage(p: number) { page.value = p; loadGoods() }
onMounted(loadGoods)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>商品管理</h2>
      <el-button :icon="Refresh" @click="loadGoods" :loading="loading">刷新</el-button>
    </div>

    <el-table :data="goods" v-loading="loading" stripe>
      <el-table-column label="图片" width="80">
        <template #default="{ row }">
          <el-image :src="row.main_image" style="width:50px;height:50px" fit="cover">
            <template #error><div style="background:#f0f2f5;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ccc">无图</div></template>
          </el-image>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="商品名称" min-width="160" />
      <el-table-column prop="brand" label="品牌" width="90" />
      <el-table-column label="价格" width="140" align="right">
        <template #default="{ row }">
          <span class="price">&yen;{{ formatPrice(row.min_price) }}</span>
          <span v-if="row.max_price > row.min_price" style="color:#999;font-size:12px">-{{ formatPrice(row.max_price) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" width="70" align="right" />
      <el-table-column label="状态" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '上架' : '下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 1 ? '下架' : '上架' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display:flex;justify-content:center;margin-top:16px" v-if="total > pageSize">
      <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="changePage" />
    </div>

    <el-dialog v-model="editVisible" title="编辑商品" width="560px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="editingGoods.name" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="editingGoods.subtitle" /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="editingGoods.brand" /></el-form-item>
        <el-form-item label="封面图"><el-input v-model="editingGoods.main_image" placeholder="https://..." /></el-form-item>
        <el-form-item label="最低价(分)">
          <el-input-number v-model="editingGoods.min_price" :min="1" :step="100" />
          <span style="margin-left:8px;font-size:12px;color:#999">&asymp; &yen;{{ formatPrice(editingGoods.min_price) }}</span>
        </el-form-item>
        <el-form-item label="最高价(分)">
          <el-input-number v-model="editingGoods.max_price" :min="1" :step="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>

<style scoped>
.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.page-header h2{font-size:20px}
</style>
