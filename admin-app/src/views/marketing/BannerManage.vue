<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import { getBanners, createBanner, updateBanner, deleteBanner } from '@/api/banner-mgmt'
import type { PageConfig } from '@/api/banner-mgmt'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Edit, Delete, Top, Bottom } from '@element-plus/icons-vue'

const configs = ref<PageConfig[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editingId = ref(0)
const form = ref({ key: '', type: 'image', value: '', label: '', link: '', sort_order: 1 })
const saving = ref(false)

async function load() {
  loading.value = true
  try { configs.value = await getBanners('home') } catch { ElMessage.error('加载轮播图失败') } finally { loading.value = false }
}

function openAdd() {
  editingId.value = 0
  form.value = { key: `home_banner_${Date.now()}`, type: 'image', value: '', label: '', link: '', sort_order: configs.value.length + 1 }
  showDialog.value = true
}
function openEdit(row: PageConfig) {
  editingId.value = row.id
  form.value = { key: row.key, type: row.type, value: row.value, label: row.label, link: row.link || '', sort_order: row.sort_order }
  showDialog.value = true
}

async function handleSave() {
  if (!form.value.value.trim()) { ElMessage.warning('请输入图片URL或文本内容'); return }
  const link = form.value.link.trim()
  if (link && !link.startsWith('/') && !link.startsWith('http')) { ElMessage.warning('跳转链接需以 / 或 http 开头'); return }
  saving.value = true
  try {
    if (editingId.value > 0) {
      await updateBanner(editingId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await createBanner({ ...form.value, page_key: 'home' } as any)
      ElMessage.success('添加成功')
    }
    showDialog.value = false; load()
  } catch { ElMessage.error('保存失败') } finally { saving.value = false }
}

async function handleDelete(row: PageConfig) {
  try { await ElMessageBox.confirm(`确定删除「${row.label || row.key}」？`, '确认', { type: 'warning' }) } catch { return }
  try { await deleteBanner(row.id); ElMessage.success('已删除'); load() } catch { ElMessage.error('删除失败') }
}

async function moveUp(idx: number) {
  if (idx <= 0) return
  const a = configs.value[idx]; const b = configs.value[idx - 1]
  // Swap locally first for instant feedback, then persist
  ;[configs.value[idx], configs.value[idx - 1]] = [b, a]
  try {
    await Promise.all([
      updateBanner(a.id, { sort_order: b.sort_order }),
      updateBanner(b.id, { sort_order: a.sort_order }),
    ])
  } catch {
    // Revert on failure
    ;[configs.value[idx], configs.value[idx - 1]] = [a, b]
    ElMessage.error('排序更新失败，请重试')
  }
}

async function moveDown(idx: number) {
  if (idx >= configs.value.length - 1) return
  const a = configs.value[idx]; const b = configs.value[idx + 1]
  ;[configs.value[idx], configs.value[idx + 1]] = [b, a]
  try {
    await Promise.all([
      updateBanner(a.id, { sort_order: b.sort_order }),
      updateBanner(b.id, { sort_order: a.sort_order }),
    ])
  } catch {
    ;[configs.value[idx], configs.value[idx + 1]] = [a, b]
    ElMessage.error('排序更新失败，请重试')
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>首页轮播图管理</h2>
      <div style="display:flex;gap:8px">
        <el-button type="primary" :icon="Plus" @click="openAdd">添加轮播图</el-button>
        <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-table :data="configs" v-loading="loading" stripe>
      <el-table-column label="预览" width="140">
        <template #default="{ row }">
          <el-image v-if="row.type === 'image'" :src="row.value" style="width:120px;height:50px;border-radius:4px" fit="cover">
            <template #error><span style="color:#ccc;font-size:11px">无图片</span></template>
          </el-image>
          <span v-else style="color:#999;font-size:12px">{{ row.value }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="label" label="名称" min-width="140" />
      <el-table-column prop="key" label="配置键" width="160" />
      <el-table-column prop="type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === 'image' ? 'primary' : 'info'" size="small">{{ row.type === 'image' ? '图片' : '文本' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="value" label="值(URL/文本)" min-width="180" show-overflow-tooltip />
      <el-table-column prop="link" label="跳转链接" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="(row as any).link" style="color:#409eff;font-size:12px">{{ (row as any).link }}</span>
          <span v-else style="color:#ccc;font-size:11px">未设置</span>
        </template>
      </el-table-column>
      <el-table-column label="排序" width="100" align="center">
        <template #default="{ row, $index }">
          <el-button link :icon="Top" :disabled="$index === 0" @click="moveUp($index)" />
          <el-button link :icon="Bottom" :disabled="$index === configs.length - 1" @click="moveDown($index)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && configs.length === 0" description="暂无轮播图，点击上方按钮添加" />

    <el-dialog v-model="showDialog" :title="editingId ? '编辑配置' : '添加配置'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.label" placeholder="如: 轮播图1" /></el-form-item>
        <el-form-item label="配置键"><el-input v-model="form.key" placeholder="home_banner_1" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="image">图片(轮播图)</el-radio>
            <el-radio value="text">文本</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="form.type === 'image' ? '图片URL' : '文本内容'">
          <el-input v-model="form.value" :placeholder="form.type === 'image' ? 'https://...' : '输入文本内容'" />
          <div v-if="form.type === 'image' && form.value" style="margin-top:8px">
            <el-image :src="form.value" style="width:100%;height:100px;border-radius:4px" fit="cover">
              <template #error><span style="color:#ccc">无法加载图片</span></template>
            </el-image>
          </div>
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="form.link" placeholder="如 /goods/1 或 https://..." />
          <span style="font-size:11px;color:#999">用户点击轮播图时跳转的目标地址</span>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" :step="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>
