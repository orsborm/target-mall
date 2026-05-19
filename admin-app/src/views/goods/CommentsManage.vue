<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import PaginationWrap from '@/components/PaginationWrap.vue'
import { getCommentList, deleteAdminComment } from '@/api/comment-mgmt'
import type { AdminComment } from '@/api/comment-mgmt'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/format'

const comments = ref<AdminComment[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20

function renderStars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

async function load() {
  loading.value = true
  try {
    const res = await getCommentList({ page: page.value, page_size: pageSize })
    comments.value = res.list; total.value = res.total
  } catch { ElMessage.error('加载评论失败') } finally { loading.value = false }
}

async function handleDelete(row: AdminComment) {
  try { await ElMessageBox.confirm(`确定删除该评论？\n用户: ${row.username}\n内容: ${row.content.slice(0, 40)}${row.content.length > 40 ? '...' : ''}`, '确认删除', { type: 'warning', confirmButtonText: '确定删除' }) } catch { return }
  try { await deleteAdminComment(row.id); ElMessage.success('已删除'); load() } catch { ElMessage.error('删除失败') }
}

function changePage(p: number) { page.value = p; load() }
onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>评论管理</h2>
      <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
    </div>

    <el-table :data="comments" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="spu_id" label="商品ID" width="80" />
      <el-table-column prop="username" label="用户" width="120" />
      <el-table-column label="评分" width="130">
        <template #default="{ row }">
          <span style="color:#f7ba2a">{{ renderStars(row.rating) }}</span>
          <span style="color:#999;font-size:12px;margin-left:4px">{{ row.rating }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at || '') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && comments.length === 0" description="暂无评论" />

    <PaginationWrap :total="total" :page-size="pageSize" :page="page" @page-change="changePage" />
  </AdminLayout>
</template>
