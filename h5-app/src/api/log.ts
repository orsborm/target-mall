import request from './request'

export interface LogStatus {
  status: string
  current_mb: number
  rotate_interval_hours: number
  backup_count: number
  file_count: number
  files: { name: string; size: number; size_mb: number; path: string; modified: number }[]
}

export interface LogSize {
  total_bytes: number
  total_mb: number
  max_mb: number
  usage_percent: number
  files: { name: string; size_bytes: number; size_mb: number; path: string }[]
}

export interface LogFile {
  name: string
  path: string
  size: number
  size_mb: number
  service: string
  modified: number
}

export interface LogContent {
  service: string
  file: string
  lines: string[]
  total_lines: number
  offset: number
  count: number
}

export interface LogSearchResult {
  service: string
  keyword: string
  level_filter: string | null
  matches: { line: number; content: string; level: string; timestamp: string }[]
  total_matches: number
}

export interface LogErrorResult {
  service: string
  error_count: number
  errors: string[]
}

export interface ClearResult {
  cleared_files: number
}

export function getLogStatus() {
  return request.get<LogStatus>('/sys/log/status')
}

export function getLogSize() {
  return request.get<LogSize>('/sys/log/size')
}

export function getLogList() {
  return request.get<LogFile[]>('/sys/log/list')
}

export function readLog(params: { lines?: number; offset?: number; service?: string }) {
  return request.get<LogContent>('/sys/log/read', { params })
}

export function searchLog(params: { keyword: string; level?: string; limit?: number; service?: string }) {
  return request.get<LogSearchResult>('/sys/log/search', { params })
}

export function getLogErrors(params?: { lines?: number; service?: string }) {
  return request.get<LogErrorResult>('/sys/log/errors', { params })
}

export function downloadLog(params?: { service?: string }) {
  return request.get('/sys/log/download', {
    params,
    responseType: 'blob',
  })
}

export function clearLogs() {
  return request.post<ClearResult>('/sys/log/clear')
}

export function deleteServiceLog(serviceName: string) {
  return request.delete<null>(`/sys/log/service/${serviceName}`)
}
