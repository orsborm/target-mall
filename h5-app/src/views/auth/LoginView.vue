<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { login } from '@/api/user'
import { getCaptcha } from '@/api/common'
import { ElMessage } from 'element-plus'
import { User, Lock, ShoppingCartFull } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const appTitle = computed(() => import.meta.env.VITE_APP_TITLE || 'H5靶机商城')
const formRef = ref()
const form = reactive({ username: '', password: '', captcha_code: '' })
const captchaImage = ref('')
const captchaId = ref('')
const loading = ref(false)
const captchaLoading = ref(false)

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha_code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
}

async function fetchCaptcha() {
  captchaLoading.value = true
  try {
    const res = await getCaptcha()
    captchaId.value = res.captcha_id
    // Ensure the data URI is valid
    if (res.captcha_image && res.captcha_image.startsWith('data:image')) {
      captchaImage.value = res.captcha_image
    }
  } catch { ElMessage.warning('验证码加载失败，请点击刷新') } finally {
    captchaLoading.value = false
  }
}
fetchCaptcha()

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!captchaId.value) {
    ElMessage.warning('验证码未加载，请点击刷新')
    return
  }

  loading.value = true
  try {
    const res = await login({
      username: form.username.trim(),
      password: form.password,
      captcha_code: form.captcha_code.trim(),
      captcha_id: captchaId.value,
    })
    userStore.setAuth(res.access_token, res.refresh_token, res.user_info)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch {
    fetchCaptcha()
    form.captcha_code = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <el-icon :size="40" color="#ff6b35"><ShoppingCartFull /></el-icon>
        <h2>登录 {{ appTitle }}</h2>
        <p>欢迎回来，请登录您的账号</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="handleLogin">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item label="验证码" prop="captcha_code">
          <div class="captcha-row">
            <el-input v-model="form.captcha_code" placeholder="验证码" style="flex:1" />
            <div class="captcha-img-wrap" @click="fetchCaptcha" title="点击刷新验证码">
              <img
                v-if="captchaImage"
                :src="captchaImage"
                class="captcha-img"
                alt="验证码"
              />
              <span v-else class="captcha-placeholder">点击获取</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading" style="width:100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        还没有账号？<router-link to="/register">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}
.login-card {
  width: 400px;
  background: #fff;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.login-header {
  text-align: center;
  margin-bottom: 30px;
}
.login-header h2 {
  font-size: 22px;
  margin: 12px 0 8px;
  color: #303133;
}
.login-header p {
  font-size: 13px;
  color: #909399;
}
.captcha-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.captcha-img-wrap {
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  height: 40px;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.captcha-img {
  height: 40px;
  display: block;
}
.captcha-placeholder {
  font-size: 12px;
  color: #c0c4cc;
  padding: 0 8px;
}
.login-footer {
  text-align: center;
  font-size: 13px;
  color: #909399;
}
</style>
