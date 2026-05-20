import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.config.errorHandler = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[h5] Unhandled error:', err)
  ElMessage.error(`系统异常: ${msg}`)
}

app.mount('#app')
