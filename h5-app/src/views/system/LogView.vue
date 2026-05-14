<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  getLogStatus, getLogSize, getLogList,
  readLog, searchLog, getLogErrors,
  downloadLog, clearLogs, deleteServiceLog,
} from '@/api/log'
import type { LogStatus, LogSize, LogFile, LogContent, LogSearchResult } from '@/api/log'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Search, Download, Refresh, View, Warning } from '@element-plus/icons-vue'

// State
const status = ref<LogStatus | null>(null)
const size = ref<LogSize | null>(null)
const files = ref<LogFile[]>([])
const loading = ref(false)

const logContent = ref<LogContent | null>(null)
const contentLoading = ref(false)
const readService = ref('')
const readLines = ref(200)
const readOffset = ref(0)

const searchKeyword = ref('')
const searchLevel = ref('')
const searchResult = ref<LogSearchResult | null>(null)
const searching = ref(false)

const activeTab = ref<'status' | 'viewer' | 'errors' | 'search'>('status')

const usagePercent = computed(() => status.value?.usage_percent || size.value?.usage_percent || 0)
const usageColor = computed(() => {
  if (usagePercent.value > 80) return '#f56c6c'
  if (usagePercent.value > 50) return '#e6a23c'
  return '#67c23a'
})

async function loadAll() {
  loading.value = true
  try {
    const [s, sz, fl] = await Promise.all([
      getLogStatus(),
      getLogSize(),
      getLogList(),
    ])
    status.value = s
    size.value = sz
    files.value = fl
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

async function handleRead() {
  contentLoading.value = true
  logContent.value = null
  try {
    const params: any = { lines: readLines.value, offset: readOffset.value }
    if (readService.value) params.service = readService.value
    logContent.value = await readLog(params)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取失败')
  } finally {
    contentLoading.value = false
  }
}

async function handleSearch() {
  if (!searchKeyword.value.trim()) { ElMessage.warning('请输入搜索关键词'); return }
  searching.value = true
  searchResult.value = null
  try {
    searchResult.value = await searchLog({
      keyword: searchKeyword.value.trim(),
      level: searchLevel.value || undefined,
      limit: 100,
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '搜索失败')
  } finally {
    searching.value = false
  }
}

async function handleErrors() {
  contentLoading.value = true
  logContent.value = null
  try {
    const params: any = { lines: 100 }
    if (readService.value) params.service = readService.value
    logContent.value = await getLogErrors(params)
  } catch (e: any) {
    ElMessage.error(e?.message || '暂无错误日志')
  } finally {
    contentLoading.value = false
  }
}

async function handleDownload() {
  try {
    const blob = await downloadLog(readService.value ? { service: readService.value } : undefined)
    const url = URL.createObjectURL(blob as unknown as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${readService.value || 'all'}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('下载中...')
  } catch {
    ElMessage.error('下载失败')
  }
}

async function handleClearAll() {
  try {
    await ElMessageBox.confirm('确定要清除所有日志文件吗？此操作不可恢复！', '危险操作', {
      confirmButtonText: '确定清除',
      cancelButtonText: '取消',
      type: 'error',
    })
  } catch { return }

  try {
    const res = await clearLogs()
    ElMessage.success(`已清除 ${res.cleared_files} 个日志文件`)
    loadAll()
    logContent.value = null
  } catch { /* ignore */ }
}

async function handleDeleteService(serviceName: string) {
  try {
    await ElMessageBox.confirm(`确定删除 ${serviceName} 的日志吗？`, '确认删除', { type: 'warning' })
  } catch { return }

  try {
    await deleteServiceLog(serviceName)
    ElMessage.success(`已删除 ${serviceName} 日志`)
    loadAll()
  } catch { /* ignore */ }
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatMb(mb: number): string {
  if (mb < 1) return (mb * 1024).toFixed(0) + ' KB'
  return mb.toFixed(2) + ' MB'
}

function levelTagType(level: string): string {
  const map: Record<string, string> = { ERROR: 'danger', WARNING: 'warning', INFO: 'info', DEBUG: '' }
  return map[level] || 'info'
}

onMounted(loadAll)
</script>

<template>
  <div class="log-page">
    <div class="page-header">
      <h2>日志管理</h2>
      <div class="page-header__actions">
        <el-button :icon="Refresh" @click="loadAll" :loading="loading">刷新</el-button>
        <el-button :icon="Download" @click="handleDownload" type="primary" plain>下载日志</el-button>
        <el-button :icon="Delete" @click="handleClearAll" type="danger" plain>清除全部日志</el-button>
      </div>
    </div>

    <!-- Status Cards -->
    <div class="log-cards" v-loading="loading">
      <div class="log-card">
        <div class="log-card__label">日志状态</div>
        <div class="log-card__value" :style="{ color: status?.status === 'ok' ? '#67c23a' : '#f56c6c' }">
          {{ status?.status === 'ok' ? '正常' : status?.status || '-' }}
        </div>
      </div>
      <div class="log-card">
        <div class="log-card__label">总大小</div>
        <div class="log-card__value">{{ size ? formatMb(size.total_mb) : '-' }}</div>
      </div>
      <div class="log-card">
        <div class="log-card__label">文件数量</div>
        <div class="log-card__value">{{ status?.file_count ?? '-' }}</div>
      </div>
      <div class="log-card">
        <div class="log-card__label">使用率</div>
        <div class="log-card__value" :style="{ color: usageColor }">{{ usagePercent.toFixed(1) }}%</div>
        <el-progress :percentage="usagePercent" :color="usageColor" :stroke-width="6" style="margin-top:6px" />
      </div>
      <div class="log-card">
        <div class="log-card__label">自动清理阈值</div>
        <div class="log-card__value">{{ status?.auto_cleanup_threshold_mb || 100 }} MB</div>
      </div>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" style="margin-top:20px">
      <el-tab-pane label="文件列表" name="status">
        <el-empty v-if="!loading && files.length === 0" description="暂无日志文件（系统尚未产生日志）" />

        <el-table v-else :data="files" stripe style="width:100%">
          <el-table-column prop="name" label="文件名" min-width="200" />
          <el-table-column prop="service" label="服务" width="150">
            <template #default="{ row }">
              <el-tag size="small">{{ row.service }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="120" align="right">
            <template #default="{ row }">
              {{ row.size_mb ? row.size_mb.toFixed(2) + ' MB' : formatSize(row.size_bytes) }}
            </template>
          </el-table-column>
          <el-table-column prop="modified_at" label="修改时间" width="180" />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :icon="View" @click="readService = row.service; activeTab = 'viewer'; handleRead()">查看</el-button>
              <el-button link type="primary" :icon="Download" @click="readService = row.service; handleDownload()">下载</el-button>
              <el-button link type="danger" :icon="Delete" @click="handleDeleteService(row.service)">清除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Log Viewer -->
      <el-tab-pane label="日志查看" name="viewer">
        <div class="viewer-toolbar">
          <el-select v-model="readService" placeholder="全部服务" clearable style="width:160px">
            <el-option v-for="s in (status?.files || [])" :key="s.service" :label="s.service" :value="s.service" />
          </el-select>
          <el-input-number v-model="readLines" :min="10" :max="2000" :step="100" />
          <span style="font-size:13px;color:#909399">行</span>
          <el-button :icon="View" type="primary" @click="handleRead" :loading="contentLoading">读取</el-button>
          <el-button :icon="Warning" type="warning" plain @click="handleErrors">最近错误</el-button>
        </div>

        <div v-loading="contentLoading" class="log-viewer">
          <div v-if="logContent" class="log-meta">
            <span>文件: {{ logContent.file }}</span>
            <span>总行数: {{ logContent.total_lines }}</span>
            <span>显示: {{ logContent.offset }} ~ {{ logContent.offset + logContent.count }}</span>
          </div>
          <div v-if="logContent && logContent.lines.length > 0" class="log-lines">
            <div
              v-for="(line, i) in logContent.lines"
              :key="i"
              class="log-line"
              :class="{
                'log-line--error': line.includes('ERROR'),
                'log-line--warn': line.includes('WARNING'),
              }"
            >
              <span class="log-line__num">{{ (logContent?.offset || 0) + i + 1 }}</span>
              <span class="log-line__text">{{ line }}</span>
            </div>
          </div>
          <el-empty v-else-if="!contentLoading" description='点击「读取」按钮查看日志内容' />
        </div>
      </el-tab-pane>

      <!-- Error Quick View -->
      <el-tab-pane label="错误日志" name="errors">
        <div class="viewer-toolbar">
          <el-select v-model="readService" placeholder="全部服务" clearable style="width:160px">
            <el-option v-for="s in (status?.files || [])" :key="s.service" :label="s.service" :value="s.service" />
          </el-select>
          <el-button :icon="Warning" type="danger" @click="handleErrors" :loading="contentLoading">查看最近错误</el-button>
        </div>

        <div v-loading="contentLoading" class="log-viewer">
          <div v-if="logContent && logContent.lines.length > 0" class="log-lines">
            <div v-for="(line, i) in logContent.lines" :key="i" class="log-line log-line--error">
              <span class="log-line__num">{{ (logContent?.offset || 0) + i + 1 }}</span>
              <span class="log-line__text">{{ line }}</span>
            </div>
          </div>
          <el-empty v-else-if="!contentLoading" description="暂无错误日志" />
        </div>
      </el-tab-pane>

      <!-- Search -->
      <el-tab-pane label="搜索日志" name="search">
        <div class="viewer-toolbar">
          <el-input v-model="searchKeyword" placeholder="关键词..." style="width:240px" clearable @keyup.enter="handleSearch" />
          <el-select v-model="searchLevel" placeholder="全部级别" clearable style="width:120px">
            <el-option label="ERROR" value="ERROR" />
            <el-option label="WARNING" value="WARNING" />
            <el-option label="INFO" value="INFO" />
            <el-option label="DEBUG" value="DEBUG" />
          </el-select>
          <el-button :icon="Search" type="primary" @click="handleSearch" :loading="searching">搜索</el-button>
        </div>

        <div v-loading="searching" class="log-viewer">
          <div v-if="searchResult" class="log-meta">
            找到 {{ searchResult.total_matches }} 条匹配
          </div>
          <div v-if="searchResult && searchResult.matches.length > 0" class="log-lines">
            <div v-for="(m, i) in searchResult.matches" :key="i" class="log-line" :class="{ 'log-line--error': m.level === 'ERROR', 'log-line--warn': m.level === 'WARNING' }">
              <span class="log-line__num">{{ m.line }}</span>
              <el-tag :type="levelTagType(m.level)" size="small" style="margin-right:8px">{{ m.level }}</el-tag>
              <span class="log-line__text">{{ m.content }}</span>
            </div>
          </div>
          <el-empty v-else-if="!searching && searchResult" description="未找到匹配结果" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.log-page {
  max-width: 1200px;
  margin: 0 auto;
}
.page-header__actions {
  display: flex;
  gap: 8px;
}
.log-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.log-card {
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
}
.log-card__label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}
.log-card__value {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}
.log-viewer {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  min-height: 300px;
  max-height: 520px;
  overflow-y: auto;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}
.log-meta {
  color: #999;
  font-size: 12px;
  margin-bottom: 12px;
  display: flex;
  gap: 20px;
}
.log-lines {
  display: flex;
  flex-direction: column;
}
.log-line {
  display: flex;
  align-items: flex-start;
  padding: 2px 0;
  color: #d4d4d4;
  line-height: 1.6;
}
.log-line--error {
  background: rgba(244, 67, 54, 0.15);
}
.log-line--warn {
  background: rgba(255, 152, 0, 0.1);
}
.log-line__num {
  color: #666;
  min-width: 48px;
  text-align: right;
  margin-right: 14px;
  flex-shrink: 0;
  user-select: none;
}
.log-line__text {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
