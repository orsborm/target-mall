<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/api/user'
import { getCaptcha } from '@/api/common'
import { ElMessage } from 'element-plus'
import { User, Phone, Lock, UserFilled } from '@element-plus/icons-vue'

const appTitle = computed(() => import.meta.env.VITE_APP_TITLE || 'H5靶机商城')
const router = useRouter()

const formRef = ref()
const form = reactive({
  username: '',
  password: '',
  confirm_password: '',
  phone: '',
  captcha_code: '',
})
const captchaImage = ref('')
const captchaId = ref('')
const loading = ref(false)
const captchaLoading = ref(false)

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20 个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/,
      message: '字母开头，只含字母/数字/下划线',
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 32, message: '密码长度 8-32 位', trigger: 'blur' },
    {
      pattern: /^(?=.*[a-zA-Z])(?=.*\d).{8,32}$/,
      message: '必须同时包含字母和数字',
      trigger: 'blur',
    },
    {
      validator: (_r: any, v: string, cb: any) => {
        if (/^(.)\1+$/.test(v)) cb(new Error('密码不能为单一重复字符'))
        else if (/^(12345678|password|admin123|qwertyui|abcdefgh)/i.test(v)) cb(new Error('密码过于简单，请更换'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_r: any, v: string, cb: any) =>
        v === form.password ? cb() : cb(new Error('两次密码不一致')),
      trigger: 'blur',
    },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确（1开头11位）', trigger: 'blur' },
  ],
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
  } catch { ElMessage.warning('验证码加载失败，请点击刷新') } finally {
    captchaLoading.value = false
  }
}
fetchCaptcha()

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!captchaId.value) {
    ElMessage.warning('验证码未加载，请点击刷新')
    return
  }

  loading.value = true
  try {
    await register({
      username: form.username.trim(),
      password: form.password,
      confirm_password: form.confirm_password,
      phone: form.phone.trim(),
      captcha_code: form.captcha_code.trim(),
      captcha_id: captchaId.value,
    })
    ElMessage.success('注册成功，请登录')
    router.replace('/login')
  } catch {
    fetchCaptcha()
    form.captcha_code = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <div class="register-header">
        <el-icon :size="40" color="#ff6b35"><UserFilled /></el-icon>
        <h2>注册账号</h2>
        <p>创建您的 {{ appTitle }} 账号</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="handleRegister">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="字母开头，3-20位字母/数字/下划线" :prefix-icon="User" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入11位手机号" :prefix-icon="Phone" maxlength="11" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="8-32位，必须包含字母和数字" show-password :prefix-icon="Lock" maxlength="32" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="form.confirm_password" type="password" placeholder="再次输入密码" show-password :prefix-icon="Lock" maxlength="32" />
        </el-form-item>
        <el-form-item label="验证码" prop="captcha_code">
          <div class="captcha-row">
            <el-input v-model="form.captcha_code" placeholder="验证码" style="flex:1" />
            <div class="captcha-img-wrap" @click="fetchCaptcha" title="点击刷新验证码">
              <img v-if="captchaImage" :src="captchaImage" class="captcha-img" alt="验证码" />
              <span v-else class="captcha-placeholder">点击获取</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading" style="width:100%">注册</el-button>
        </el-form-item>
      </el-form>

      <div class="register-footer">
        已有账号？<router-link to="/login">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}
.register-card {
  width: 440px;
  background: #fff;
  padding: 36px 40px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.register-header {
  text-align: center;
  margin-bottom: 24px;
}
.register-header h2 {
  font-size: 22px;
  margin: 10px 0 6px;
  color: #303133;
}
.register-header p {
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
.register-footer {
  text-align: center;
  font-size: 13px;
  color: #909399;
}
</style>
