<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import PaginationWrap from '@/components/PaginationWrap.vue'
import { getGoodsList, updateGoodsStatus, updateGoods, getGoodsDetail, updateSkus, createGoods, deleteGoods, getCategoryTree, createCategory, updateCategory, deleteCategory } from '@/api/goods-mgmt'
import type { GoodsItem, SkuInfo, GoodsCategory } from '@/api/goods-mgmt'
import { formatPrice, formatDate, DEFAULT_PAGE_SIZE } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Edit, Delete, Plus } from '@element-plus/icons-vue'

interface GoodsItemExt extends GoodsItem { sales: number; total_stock: number; images?: string[] }

const goods = ref<GoodsItemExt[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const pageSize = DEFAULT_PAGE_SIZE
const editVisible = ref(false)
const editingGoods = reactive<Partial<GoodsItemExt>>({})
const editingId = ref(0)
const saving = ref(false)
const editingImages = ref<string[]>([])
const newImageUrl = ref('')
const editingSkus = ref<SkuInfo[]>([])
const skuLoading = ref(false)

// ---- create state ----
const createVisible = ref(false)
interface CreateSkuEntry { _key?: number; sku_code: string; price: number; stock: number; main_image: string; specs: string }
const creatingGoods = reactive({
  spu_code: '', name: '', subtitle: '', brand: '', category_id: 1,
  main_image: '', min_price: 0.01, max_price: 0.01, sales: 0, status: 1,
})
const creatingImages = ref<string[]>([])
const newCreateImageUrl = ref('')
const creatingSkus = ref<CreateSkuEntry[]>([])
const creating = ref(false)

const categories = ref<GoodsCategory[]>([])
const filterCategory = ref<number>(0)
const filterKeyword = ref('')

async function loadCategories() {
  try { categories.value = await getCategoryTree() } catch { ElMessage.warning('加载分类列表失败，分类选择不可用') }
}

function getCategoryName(id: number): string {
  const cat = flattenCategories(categories.value).find(c => c.id === id)
  return cat?.name || String(id)
}

function flattenCategories(list: GoodsCategory[], depth = 0): { id: number; name: string }[] {
  const result: { id: number; name: string }[] = []
  for (const c of list) {
    result.push({ id: c.id, name: (depth > 0 ? '　'.repeat(depth) : '') + c.name })
    if (c.children && c.children.length > 0) {
      result.push(...flattenCategories(c.children, depth + 1))
    }
  }
  return result
}

function openCreate() {
  creatingGoods.spu_code = ''; creatingGoods.name = ''; creatingGoods.subtitle = ''
  creatingGoods.brand = ''; creatingGoods.category_id = 1
  creatingGoods.main_image = ''; creatingGoods.min_price = 0.01
  creatingGoods.max_price = 0.01; creatingGoods.sales = 0; creatingGoods.status = 1
  creatingImages.value = []; newCreateImageUrl.value = ''; creatingSkus.value = []
  createVisible.value = true
}
function addCreateImage() {
  const url = newCreateImageUrl.value.trim()
  if (!url) { ElMessage.warning('请输入图片URL'); return }
  creatingImages.value.push(url); newCreateImageUrl.value = ''
}
function removeCreateImage(idx: number) { creatingImages.value.splice(idx, 1) }
function setAsCreateMain(url: string) { creatingGoods.main_image = url }

function addCreateSku() {
  creatingSkus.value.push({ sku_code: '', price: 0.01, stock: 0, main_image: '', specs: '', _key: Date.now() + Math.random() })
}
function removeCreateSku(idx: number) { creatingSkus.value.splice(idx, 1) }

async function handleDelete(row: GoodsItemExt) {
  try { await ElMessageBox.confirm(`确定删除商品「${row.name}」？`, '确认删除', { type: 'error', confirmButtonText: '确定删除' }) } catch { return }
  try {
    await deleteGoods(row.id)
    ElMessage.success('商品已删除')
    loadGoods()
  } catch { ElMessage.error('删除失败') }
}

async function handleCreate() {
  if (!creatingGoods.name.trim()) { ElMessage.warning('请输入商品名称'); return }
  if (creatingGoods.min_price > creatingGoods.max_price) { ElMessage.warning('最低价不能大于最高价'); return }
  creating.value = true
  try {
    const body: Record<string, unknown> = {
      spu_code: creatingGoods.spu_code || `SPU${Date.now()}`,
      name: creatingGoods.name, subtitle: creatingGoods.subtitle,
      category_id: creatingGoods.category_id, brand: creatingGoods.brand,
      main_image: creatingGoods.main_image, images: creatingImages.value,
      min_price: Math.round((creatingGoods.min_price || 0) * 100),
      max_price: Math.round((creatingGoods.max_price || 0) * 100),
      sales: creatingGoods.sales, status: creatingGoods.status,
    }
    if (creatingSkus.value.length > 0) {
      body.skus = creatingSkus.value.map(s => {
        const specs: Record<string, string> = {}
        if (s.specs.trim()) {
          s.specs.split(',').forEach(pair => {
            const [k, v] = pair.split(':').map(x => x.trim())
            if (k && v) specs[k] = v
          })
        }
        return {
          sku_code: s.sku_code, price: Math.round((s.price || 0) * 100),
          stock: s.stock, main_image: s.main_image, specs,
        }
      })
    }
    await createGoods(body)
    ElMessage.success('商品创建成功')
    createVisible.value = false
    loadGoods()
  } catch { ElMessage.error('创建失败') } finally { creating.value = false }
}

async function loadGoods() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, page_size: pageSize }
    if (filterCategory.value > 0) params.category_id = filterCategory.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await getGoodsList(params)
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
  // Store targetId locally to prevent a race: if the user clicks Edit on
  // row A then quickly clicks row B before A's getGoodsDetail resolves,
  // A's SKU data would overwrite B's form.  Comparing against the captured
  // targetId after the await discards stale responses.
  const targetId = row.id
  editingId.value = targetId
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
  // Async load SKU data
  skuLoading.value = true
  try {
    const detail = await getGoodsDetail(targetId)
    if (editingId.value !== targetId) return
    editingSkus.value = (detail.skus || []).map(s => ({ ...s, price: +(s.price / 100).toFixed(2) }))
  } catch { /* SKU load failed, editing continues */ } finally { if (editingId.value === targetId) skuLoading.value = false }
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
  if ((editingGoods.min_price ?? 0) > (editingGoods.max_price ?? 0)) { ElMessage.warning('最低价不能大于最高价'); return }
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
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
      await updateSkus(editingId.value, skuUpdates).catch(() => {
        ElMessage.warning('商品信息已保存，但 SKU 价格/图片更新失败——请重新编辑 SKU 并保存')
      })
    }
    ElMessage.success('商品更新成功')
    editVisible.value = false
    loadGoods()
  } catch { ElMessage.error('更新失败') } finally { saving.value = false }
}

// ---- Category management ----
const catDialogVisible = ref(false)
const catForm = ref({ name: '', parent_id: 0, level: 1, sort_order: 1 })
const editingCatId = ref(0)
const catSaving = ref(false)

function openCatDialog() { catDialogVisible.value = true }
function openAddCat() {
  editingCatId.value = 0
  catForm.value = { name: '', parent_id: 0, level: 1, sort_order: categories.value.length + 1 }
}
function openEditCat(cat: GoodsCategory) {
  editingCatId.value = cat.id
  catForm.value = { name: cat.name, parent_id: cat.parent_id, level: cat.level, sort_order: cat.sort_order }
}
async function handleCatSave() {
  if (!catForm.value.name.trim()) { ElMessage.warning('请输入分类名称'); return }
  catSaving.value = true
  try {
    if (editingCatId.value > 0) {
      await updateCategory(editingCatId.value, { name: catForm.value.name.trim(), sort_order: catForm.value.sort_order })
    } else {
      await createCategory({ name: catForm.value.name.trim(), parent_id: catForm.value.parent_id, level: catForm.value.level, sort_order: catForm.value.sort_order })
    }
    ElMessage.success(editingCatId.value > 0 ? '分类已更新' : '分类已创建')
    await loadCategories()
  } catch { ElMessage.error('操作失败') } finally { catSaving.value = false }
}
async function handleCatDelete(cat: GoodsCategory) {
  try { await ElMessageBox.confirm(`确定删除分类「${cat.name}」？关联商品将保留。`, '确认删除', { type: 'warning' }) } catch { return }
  try { await deleteCategory(cat.id); ElMessage.success('已删除'); await loadCategories() } catch { ElMessage.error('删除失败') }
}

function changePage(p: number) { page.value = p; loadGoods() }
function searchGoods() { page.value = 1; loadGoods() }
onMounted(() => { loadCategories(); loadGoods() })
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>商品管理</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <el-select v-model="filterCategory" placeholder="全部分类" size="default" style="width:140px" @change="searchGoods" clearable>
          <el-option :value="0" label="全部分类" />
          <el-option v-for="c in flattenCategories(categories)" :key="c.id" :value="c.id" :label="c.name" />
        </el-select>
        <el-input v-model="filterKeyword" placeholder="搜索商品名称" size="default" style="width:200px" clearable @keyup.enter="searchGoods" @clear="searchGoods" />
        <el-button type="primary" @click="searchGoods">搜索</el-button>
        <el-button type="success" :icon="Plus" @click="openCreate">增加商品</el-button>
        <el-button @click="openCatDialog">管理分类</el-button>
        <el-button :icon="Refresh" @click="loadGoods" :loading="loading">刷新</el-button>
      </div>
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
      <el-table-column label="分类" width="100">
        <template #default="{ row }">{{ getCategoryName(row.category_id) }}</template>
      </el-table-column>
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
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 1 ? '下架' : '上架' }}
          </el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <PaginationWrap :total="total" :page-size="pageSize" :page="page" @page-change="changePage" />

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

    <!-- 增加商品 -->
    <el-dialog v-model="createVisible" title="增加商品" width="720px">
      <el-form label-width="90px">
        <el-form-item label="SPU编码">
          <el-input v-model="creatingGoods.spu_code" placeholder="留空则自动生成" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="creatingGoods.name" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="creatingGoods.subtitle" placeholder='如 Cherry轴 高品质' />
        </el-form-item>
        <el-form-item label="品牌">
          <el-input v-model="creatingGoods.brand" placeholder="如 罗技" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="creatingGoods.category_id" placeholder="选择分类" style="width:100%">
            <el-option v-for="c in flattenCategories(categories)" :key="c.id" :value="c.id" :label="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="creatingGoods.status" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
        </el-form-item>

        <el-form-item label="封面图">
          <div style="display:flex;align-items:center;gap:10px">
            <el-image v-if="creatingGoods.main_image" :src="creatingGoods.main_image" style="width:80px;height:80px;border-radius:6px;border:2px solid #ff6b35" fit="cover">
              <template #error><div style="background:#f0f2f5;width:80px;height:80px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ccc">无图</div></template>
            </el-image>
            <el-input v-model="creatingGoods.main_image" placeholder="主图URL" style="flex:1" />
          </div>
        </el-form-item>

        <el-form-item label="商品图片">
          <div style="width:100%">
            <div v-if="creatingImages.length > 0" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              <div v-for="(img, idx) in creatingImages" :key="idx" style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:2px solid #e8e8e8">
                <el-image :src="img" style="width:100%;height:100%" fit="cover">
                  <template #error><div style="background:#f0f2f5;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ccc">无图</div></template>
                </el-image>
                <div style="position:absolute;bottom:0;left:0;right:0;display:flex">
                  <el-button size="small" text style="flex:1;font-size:11px;background:rgba(0,0,0,.6);color:#fff;border-radius:0" @click="setAsCreateMain(img)">设为主图</el-button>
                  <el-button size="small" text style="font-size:11px;background:rgba(244,67,54,.8);color:#fff;border-radius:0" @click="removeCreateImage(idx)"><el-icon><Delete /></el-icon></el-button>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <el-input v-model="newCreateImageUrl" placeholder="输入新图片URL" @keyup.enter="addCreateImage" style="flex:1" />
              <el-button type="primary" :icon="Plus" @click="addCreateImage">添加</el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="SKU配置">
          <div style="width:100%">
            <div v-if="creatingSkus.length === 0" style="color:#999;font-size:13px;margin-bottom:8px">暂未添加 SKU，可创建后编辑</div>
            <div v-for="(sku, idx) in creatingSkus" :key="sku._key || idx" style="margin-bottom:12px;padding:10px;background:#fafafa;border-radius:6px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:12px;color:#666;font-weight:500">SKU #{{ idx + 1 }}</span>
                <el-button link type="danger" size="small" :icon="Delete" @click="removeCreateSku(idx)">删除</el-button>
              </div>
              <div style="display:flex;gap:6px;margin-bottom:6px">
                <el-input v-model="sku.sku_code" placeholder="SKU编码" size="small" style="flex:1" />
                <div style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
                  售价 ¥<el-input-number v-model="sku.price" :min="0.01" :step="1" :precision="2" size="small" controls-position="right" style="width:120px" />
                </div>
                <div style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
                  库存 <el-input-number v-model="sku.stock" :min="0" :step="1" size="small" controls-position="right" style="width:90px" />
                </div>
              </div>
              <div style="display:flex;gap:6px">
                <el-input v-model="sku.main_image" placeholder="图片URL" size="small" style="flex:1" />
                <el-input v-model="sku.specs" placeholder="规格, 如: 颜色:黑色, 尺寸:L" size="small" style="flex:1.5" />
              </div>
            </div>
            <el-button type="primary" plain size="small" :icon="Plus" @click="addCreateSku" style="margin-top:4px">添加 SKU</el-button>
          </div>
        </el-form-item>

        <el-form-item label="最低价(元)">
          <el-input-number v-model="creatingGoods.min_price" :min="0.01" :step="1" :precision="2" />
        </el-form-item>
        <el-form-item label="最高价(元)">
          <el-input-number v-model="creatingGoods.max_price" :min="0.01" :step="1" :precision="2" />
        </el-form-item>
        <el-form-item label="销量">
          <el-input-number v-model="creatingGoods.sales" :min="0" :step="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分类管理对话框 -->
    <el-dialog v-model="catDialogVisible" title="管理商品分类" width="600px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <el-input v-model="catForm.name" placeholder="分类名称" size="small" style="width:140px" />
        <el-select v-model="catForm.parent_id" size="small" style="width:120px">
          <el-option :value="0" label="顶级分类" />
          <el-option v-for="c in categories" :key="c.id" :value="c.id" :label="c.name" />
        </el-select>
        <el-input-number v-model="catForm.sort_order" :min="1" :step="1" size="small" style="width:90px" />
        <el-button type="primary" size="small" :loading="catSaving" @click="handleCatSave">
          {{ editingCatId > 0 ? '更新' : '添加' }}
        </el-button>
        <el-button v-if="editingCatId > 0" size="small" @click="openAddCat">取消编辑</el-button>
      </div>
      <el-table :data="categories" size="small">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="名称" width="140" />
        <el-table-column prop="level" label="层级" width="60" />
        <el-table-column prop="sort_order" label="排序" width="70" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditCat(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleCatDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </AdminLayout>
</template>

<style scoped>
</style>
