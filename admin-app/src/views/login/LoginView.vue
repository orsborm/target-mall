<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { adminLogin, getCaptcha } from '@/api/auth'
import { useAdminStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const formRef = ref()
const form = reactive({ username: '', password: '', captcha_code: '' })
const captchaImage = ref('')
const captchaId = ref('')
const captchaLoading = ref(false)
const loading = ref(false)

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
    if (res.captcha_image && res.captcha_image.startsWith('data:image')) {
      captchaImage.value = res.captcha_image
    }
  } catch {
    ElMessage.warning('验证码加载失败，请点击刷新')
  } finally {
    captchaLoading.value = false
  }
}
fetchCaptcha()

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!captchaId.value) { ElMessage.warning('验证码未加载，请点击刷新'); return }
  loading.value = true
  try {
    const res = await adminLogin({
      username: form.username.trim(), password: form.password,
      captcha_code: form.captcha_code.trim(), captcha_id: captchaId.value,
    })
    adminStore.setAuth(res.access_token, res.refresh_token, res.user_info)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect.startsWith('/') ? redirect : '/')
  } catch {
    fetchCaptcha()
    form.captcha_code = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="login-card">
      <h2>靶机管理后台</h2>
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
            <div class="captcha-box" @click="fetchCaptcha" title="点击刷新验证码">
              <img v-if="captchaImage" :src="captchaImage" alt="验证码" style="height:40px" />
              <span v-else class="captcha-placeholder">点击获取</span>
            </div>
          </div>
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width:100%">登录管理后台</el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.admin-login{display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f7fa}
.login-card{width:420px;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.login-card h2{text-align:center;margin-bottom:30px;font-size:22px;color:#303133}
.captcha-row{display:flex;gap:10px;align-items:center}
.captcha-box{cursor:pointer;border:1px solid #dcdfe6;border-radius:4px;height:40px;min-width:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.captcha-placeholder{font-size:12px;color:#c0c4cc;padding:0 8px}
</style>
