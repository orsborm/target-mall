<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMsgList, markAsRead, markAllAsRead } from '@/api/msg'
import type { MessageItem } from '@/api/msg'
import { formatDate } from '@/utils/format'
import { ElMessage } from 'element-plus'

const messages = ref<MessageItem[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = 20

async function loadMessages(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; messages.value = [] }
  loading.value = true; error.value = ''
  try {
    const res = await getMsgList({ page: page.value, page_size: pageSize })
    if (reset) messages.value = res.list
    else messages.value.push(...res.list)
    total.value = res.total
  } catch { error.value = '加载消息失败，请重试' } finally { loading.value = false }
}

async function handleItemClick(msg: MessageItem) {
  if (!msg.is_read) {
    try { await markAsRead(msg.id); msg.is_read = true } catch { /* ignore */ }
  }
}

async function handleReadAll() {
  try { await markAllAsRead(); messages.value.forEach(m => m.is_read = true); ElMessage.success('全部已读') } catch { /* ignore */ }
}

function changePage(p: number) { page.value = p; loadMessages(true) }

onMounted(() => loadMessages(true))
</script>

<template>
  <div class="msg-page">
    <div class="page-header">
      <h2>消息通知</h2>
      <el-button link type="primary" @click="handleReadAll">全部已读</el-button>
    </div>

    <div v-loading="loading">
      <el-result v-if="error" icon="error" :title="error">
        <template #extra><el-button type="primary" @click="loadMessages(true)">重试</el-button></template>
      </el-result>
      <el-empty v-else-if="!loading && messages.length === 0" description="暂无消息" />

      <div v-else class="msg-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="msg-item"
          :class="{ 'msg-item--unread': !msg.is_read }"
          @click="handleItemClick(msg)"
        >
          <el-badge :is-dot="!msg.is_read" class="msg-dot" />
          <div class="msg-item__content">
            <div class="msg-item__header">
              <strong>{{ msg.title }}</strong>
              <span class="msg-time">{{ formatDate(msg.created_at) }}</span>
            </div>
            <div class="msg-item__text">{{ msg.content }}</div>
          </div>
        </div>
      </div>

      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="changePage" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-page { max-width: 900px; margin: 0 auto; }
.msg-list { display: flex; flex-direction: column; gap: 8px; }
.msg-item { display: flex; gap: 12px; background: #fff; padding: 16px 20px; border-radius: 8px; cursor: pointer; transition: box-shadow .2s; }
.msg-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.msg-item--unread { border-left: 3px solid #ff6b35; }
.msg-item__content { flex: 1; }
.msg-item__header { display: flex; justify-content: space-between; align-items: center; }
.msg-item__text { font-size: 13px; color: #666; margin-top: 6px; }
.msg-time { font-size: 12px; color: #bbb; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 20px; }
</style>
