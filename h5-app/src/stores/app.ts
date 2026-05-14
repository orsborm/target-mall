import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PageConfig {
  key: string
  type: string
  value: string
  label: string
}

export const useAppStore = defineStore('app', () => {
  const pageConfigs = ref<PageConfig[]>([])

  function setPageConfigs(configs: PageConfig[]) {
    pageConfigs.value = configs
  }

  function getConfigValue(key: string): string {
    const item = pageConfigs.value.find((c) => c.key === key)
    return item?.value || ''
  }

  return { pageConfigs, setPageConfigs, getConfigValue }
})
