<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import PaginationWrap from '@/components/PaginationWrap.vue'
import { getFeedbackList, updateFeedbackStatus } from '@/api/feedback-mgmt'
import type { FeedbackItem } from '@/api/feedback-mgmt'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/format'

const feedbacks = ref<FeedbackItem[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterType = ref('')
const detailVisible = ref(false)
const currentItem = ref<FeedbackItem | null>(null)

const TYPE_MAP: Record<string, { text: string; type: string }> = {
  bug: { text: '问题反馈', type: 'danger' },
  suggest: { text: '功能建议', type: 'primary' },
  complaint: { text: '投诉', type: 'warning' },
  other: { text: '其他', type: 'info' },
}

async function load() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, page_size: pageSize }
    if (filterType.value && filterType.value !== 'all') params.type = filterType.value
    const res = await getFeedbackList(params)
    feedbacks.value = res.list; total.value = res.total
  } catch { ElMessage.error('加载反馈列表失败') } finally { loading.value = false }
}

function openDetail(row: FeedbackItem) { currentItem.value = row; detailVisible.value = true }

async function handleMarkDone(row: FeedbackItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '标记为已处理' : '标记为未处理'
  try { await ElMessageBox.confirm(`确定${action}？`, '确认', { type: 'warning' }) } catch { return }
  try { await updateFeedbackStatus(row.id, newStatus); row.status = newStatus; ElMessage.success('状态已更新') } catch { ElMessage.error('操作失败') }
}

function changePage(p: number) { page.value = p; load() }
function changeType() { page.value = 1; load() }
onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>意见反馈管理</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <el-select v-model="filterType" placeholder="全部类型" size="default" style="width:130px" @change="changeType" clearable>
          <el-option value="all" label="全部" />
          <el-option value="bug" label="问题反馈" />
          <el-option value="suggest" label="功能建议" />
          <el-option value="complaint" label="投诉" />
          <el-option value="other" label="其他" />
        </el-select>
        <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-table :data="feedbacks" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="TYPE_MAP[row.type]?.type || 'info'" size="small">{{ TYPE_MAP[row.type]?.text || row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
      <el-table-column prop="contact" label="联系方式" width="160">
        <template #default="{ row }">{{ row.contact || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">{{ row.status === 1 ? '已处理' : '未处理' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="提交时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at || '') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleMarkDone(row)">
            {{ row.status === 1 ? '标为未处理' : '标为已处理' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && feedbacks.length === 0" description="暂无反馈" />

    <PaginationWrap :total="total" :page-size="pageSize" :page="page" @page-change="changePage" />

    <!-- 反馈详情弹窗 -->
    <el-dialog v-model="detailVisible" title="反馈详情" width="560px">
      <template v-if="currentItem">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">{{ currentItem.id }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="TYPE_MAP[currentItem.type]?.type || 'info'" size="small">{{ TYPE_MAP[currentItem.type]?.text || currentItem.type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ currentItem.contact || '-' }}</el-descriptions-item>
          <el-descriptions-item label="时间">{{ formatDate(currentItem.created_at || '') }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentItem.status === 1 ? 'success' : 'warning'" size="small">{{ currentItem.status === 1 ? '已处理' : '未处理' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="内容">
            <div style="white-space:pre-wrap;max-height:300px;overflow-y:auto">{{ currentItem.content }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </AdminLayout>
</template>
