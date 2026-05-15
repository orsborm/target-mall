<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getGoodsList, updateGoodsStatus, updateGoods, getGoodsDetail, updateSkus } from '@/api/goods-mgmt'
import type { GoodsItem, SkuInfo } from '@/api/goods-mgmt'
import { formatPrice, formatDate } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Edit, Delete, Plus } from '@element-plus/icons-vue'

interface GoodsItemExt extends GoodsItem { sales: number; total_stock: number; images?: string[] }

const goods = ref<GoodsItemExt[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const pageSize = 20
const editVisible = ref(false)
const editingGoods = reactive<Partial<GoodsItemExt>>({})
const editingId = ref(0)
const saving = ref(false)
const editingImages = ref<string[]>([])
const newImageUrl = ref('')
const editingSkus = ref<SkuInfo[]>([])
const skuLoading = ref(false)

async function loadGoods() {
  loading.value = true
  try {
    const res = await getGoodsList({ page: page.value, page_size: pageSize })
    goods.value = res.list as GoodsItemExt[]; total.value = res.total
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

async function openEdit(row: GoodsItemExt) {
  editingId.value = row.id
  editingGoods.name = row.name
  editingGoods.subtitle = row.subtitle
  editingGoods.brand = row.brand
  editingGoods.main_image = row.main_image
  editingGoods.min_price = +(row.min_price / 100).toFixed(2)
  editingGoods.max_price = +(row.max_price / 100).toFixed(2)
  editingGoods.sales = row.sales ?? 0
  editingGoods.total_stock = row.total_stock ?? 0
  editingImages.value = [...(row.images || [])]
  newImageUrl.value = ''
  editingSkus.value = []
  editVisible.value = true
  // 异步加载 SKU 数据
  skuLoading.value = true
  try {
    const detail = await getGoodsDetail(row.id)
    editingSkus.value = (detail.skus || []).map(s => ({ ...s, price: +(s.price / 100).toFixed(2) }))
  } catch { /* SKU 加载失败不影响编辑 */ } finally { skuLoading.value = false }
}

function addImage() {
  const url = newImageUrl.value.trim()
  if (!url) { ElMessage.warning('请输入图片URL'); return }
  editingImages.value.push(url)
  newImageUrl.value = ''
}
function removeImage(idx: number) { editingImages.value.splice(idx, 1) }
function setAsMain(url: string) { editingGoods.main_image = url }

async function handleSave() {
  saving.value = true
  try {
    const payload: any = {
      name: editingGoods.name, subtitle: editingGoods.subtitle,
      brand: editingGoods.brand, main_image: editingGoods.main_image,
      min_price: Math.round((editingGoods.min_price || 0) * 100),
      max_price: Math.round((editingGoods.max_price || 0) * 100),
      sales: editingGoods.sales, total_stock: editingGoods.total_stock,
      images: editingImages.value,
    }
    await updateGoods(editingId.value, payload)
    // 保存 SKU 图片 + 价格
    if (editingSkus.value.length > 0) {
      const skuUpdates = editingSkus.value.map(s => ({
        id: s.id, main_image: s.main_image,
        price: Math.round((s.price || 0) * 100),
      }))
      await updateSkus(editingId.value, skuUpdates).catch(() => {})
    }
    const g = goods.value.find(g => g.id === editingId.value)
    if (g) Object.assign(g, editingGoods)
    ElMessage.success('商品更新成功')
    editVisible.value = false
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
      <el-table-column label="库存" width="80" align="right">
        <template #default="{ row }">
          <span :style="{ color: (row.total_stock ?? 0) <= 10 ? '#f56c6c' : '#333', fontWeight: (row.total_stock ?? 0) <= 5 ? '700' : '400' }">
            {{ row.total_stock ?? '-' }}
          </span>
        </template>
      </el-table-column>
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

    <el-dialog v-model="editVisible" title="编辑商品" width="680px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="editingGoods.name" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="editingGoods.subtitle" /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="editingGoods.brand" /></el-form-item>

        <!-- 封面图 -->
        <el-form-item label="封面图">
          <div style="display:flex;align-items:center;gap:10px">
            <el-image v-if="editingGoods.main_image" :src="editingGoods.main_image" style="width:80px;height:80px;border-radius:6px;border:2px solid #ff6b35" fit="cover">
              <template #error><div style="background:#f0f2f5;width:80px;height:80px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ccc">无图</div></template>
            </el-image>
            <el-input v-model="editingGoods.main_image" placeholder="主图URL" style="flex:1" />
          </div>
        </el-form-item>

        <!-- 商品图片列表 -->
        <el-form-item label="商品图片">
          <div style="width:100%">
            <div v-if="editingImages.length > 0" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              <div v-for="(img, idx) in editingImages" :key="idx" style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:2px solid #e8e8e8">
                <el-image :src="img" style="width:100%;height:100%" fit="cover">
                  <template #error><div style="background:#f0f2f5;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ccc">无图</div></template>
                </el-image>
                <div style="position:absolute;bottom:0;left:0;right:0;display:flex">
                  <el-button size="small" text style="flex:1;font-size:11px;background:rgba(0,0,0,.6);color:#fff;border-radius:0" @click="setAsMain(img)">设为主图</el-button>
                  <el-button size="small" text style="font-size:11px;background:rgba(244,67,54,.8);color:#fff;border-radius:0" @click="removeImage(idx)"><el-icon><Delete /></el-icon></el-button>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <el-input v-model="newImageUrl" placeholder="输入新图片URL" @keyup.enter="addImage" style="flex:1" />
              <el-button type="primary" :icon="Plus" @click="addImage">添加</el-button>
            </div>
          </div>
        </el-form-item>

        <!-- SKU 配置 -->
        <el-form-item label="SKU配置">
          <div v-loading="skuLoading" style="width:100%">
            <div v-if="editingSkus.length === 0 && !skuLoading" style="color:#999;font-size:13px">该商品暂无 SKU</div>
            <div v-for="sku in editingSkus" :key="sku.id" style="margin-bottom:12px;padding:10px;background:#fafafa;border-radius:6px">
              <div style="font-size:12px;color:#666;margin-bottom:6px;font-weight:500">{{ sku.sku_code }} <span v-if="Object.keys(sku.specs||{}).length" style="color:#999">({{ Object.values(sku.specs).join(' / ') }})</span></div>
              <div style="display:flex;gap:8px;align-items:center">
                <el-image :src="sku.main_image" style="width:52px;height:52px;border-radius:4px;flex-shrink:0" fit="cover">
                  <template #error><div style="background:#f0f2f5;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#ccc">无图</div></template>
                </el-image>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <el-input v-model="sku.main_image" placeholder="图片URL" size="small" />
                  <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:12px;color:#999;white-space:nowrap">售价 ¥</span>
                    <el-input-number v-model="sku.price" :min="0.01" :step="1" :precision="2" size="small" controls-position="right" style="width:140px" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="最低价(元)">
          <el-input-number v-model="editingGoods.min_price" :min="0.01" :step="1" :precision="2" />
        </el-form-item>
        <el-form-item label="最高价(元)">
          <el-input-number v-model="editingGoods.max_price" :min="0.01" :step="1" :precision="2" />
        </el-form-item>
        <el-form-item label="销量">
          <el-input-number v-model="editingGoods.sales" :min="0" :step="1" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="editingGoods.total_stock" :min="0" :step="1" />
          <span style="margin-left:8px;font-size:12px;color:#999">件（各SKU库存之和）</span>
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
