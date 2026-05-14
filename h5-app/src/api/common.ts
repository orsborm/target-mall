import request from './request'

export interface CaptchaResult {
  captcha_id: string
  captcha_image: string
}

export interface DictItem {
  label: string
  value: string | number
  children?: DictItem[]
}

export function getCaptcha() {
  return request.get<CaptchaResult>('/sys/common/captcha')
}

export function getPageConfig(pageKey: string) {
  return request.get<{ key: string; type: string; value: string; label: string }[]>(
    `/sys/page-config/${pageKey}`,
  )
}

export function submitFeedback(data: { type: string; content: string; contact?: string; images?: string[] }) {
  return request.post<{ id: number }>('/msg/feedback/', data)
}
