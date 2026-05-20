<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/AdminLayout.vue'
import PaginationWrap from '@/components/PaginationWrap.vue'
import { getUserList, updateUserStatus } from '@/api/user-mgmt'
import type { UserItem } from '@/api/user-mgmt'
import { formatDate, DEFAULT_PAGE_SIZE } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

const users = ref<UserItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const pageSize = DEFAULT_PAGE_SIZE

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUserList({ page: page.value, page_size: pageSize })
    users.value = res.list; total.value = res.total
  } catch { ElMessage.error('加载用户列表失败，请稍后重试') } finally { loading.value = false }
}

async function toggleStatus(row: UserItem) {
  const action = row.status === 1 ? '禁用' : '启用'
  try { await ElMessageBox.confirm(`确定${action}用户「${row.username}」？`, '确认操作', { type: 'warning' }) } catch { return }
  try {
    const newStatus = row.status === 1 ? 0 : 1
    await updateUserStatus(row.id, newStatus)
    row.status = newStatus
    ElMessage.success(`${action}成功`)
  } catch { ElMessage.error('状态修改失败，请稍后重试') }
}

function changePage(p: number) { page.value = p; loadUsers() }

onMounted(loadUsers)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2>用户管理</h2>
      <el-button :icon="Refresh" @click="loadUsers" :loading="loading">刷新</el-button>
    </div>

    <el-table :data="users" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" width="130" />
      <el-table-column prop="nickname" label="昵称" width="130" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="email" label="邮箱" width="180" />
      <el-table-column prop="role_code" label="角色" width="110">
        <template #default="{ row }"><el-tag size="small">{{ row.role_code }}</el-tag></template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="注册时间" width="160">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link :type="row.status === 1 ? 'danger' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display:flex;justify-content:center;margin-top:16px" v-if="total > pageSize">
      <PaginationWrap :total="total" :page-size="pageSize" :page="page" @page-change="changePage" />
    </div>

    <el-empty v-if="!loading && users.length === 0" description="暂无用户数据" />
  </AdminLayout>
</template>

<style scoped>
</style>
