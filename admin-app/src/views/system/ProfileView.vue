<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '@/components/AdminLayout.vue'
import { useAdminStore } from '@/stores/user'
import { adminLogout } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
const store = useAdminStore()
const router = useRouter()

// ---- Profile edit ----
const editVisible = ref(false)
const editForm = reactive({ nickname: '', phone: '', email: '' })
const editSaving = ref(false)

function openEdit() {
  if (!store.userInfo) return
  editForm.nickname = store.userInfo.nickname || ''
  editForm.phone = store.userInfo.phone || ''
  editForm.email = store.userInfo.email || ''
  editVisible.value = true
}

async function handleEditSave() {
  editSaving.value = true
  try {
    const { default: request } = await import('@/api/request')
    await request.put('/user/profile/', {
      nickname: editForm.nickname.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
    })
    if (store.userInfo) {
      store.userInfo.nickname = editForm.nickname.trim()
      store.userInfo.phone = editForm.phone.trim()
      store.userInfo.email = editForm.email.trim()
    }
    ElMessage.success('个人信息已更新')
    editVisible.value = false
  } catch { ElMessage.error('保存失败') } finally { editSaving.value = false }
}

// ---- Password change ----
const pwdVisible = ref(false)
const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })
const pwdSaving = ref(false)

function validatePwd(): boolean {
  if (!pwdForm.old_password) { ElMessage.warning('请输入旧密码'); return false }
  if (!pwdForm.new_password || pwdForm.new_password.length < 6) { ElMessage.warning('新密码至少6位'); return false }
  if (pwdForm.new_password !== pwdForm.confirm_password) { ElMessage.warning('两次密码不一致'); return false }
  if (pwdForm.new_password === pwdForm.old_password) { ElMessage.warning('新密码不能与旧密码相同'); return false }
  return true
}

async function handlePwdSave() {
  if (!validatePwd()) return
  pwdSaving.value = true
  try {
    const { default: request } = await import('@/api/request')
    await request.put('/user/profile/password', {
      old_password: pwdForm.old_password,
      new_password: pwdForm.new_password,
    })
    ElMessage.success('密码已修改，请重新登录')
    pwdVisible.value = false
    store.logout()
    router.push('/login')
  } catch { ElMessage.error('修改密码失败') } finally { pwdSaving.value = false }
}

async function handleLogout() {
  try { await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' }) } catch { return }
  try { await adminLogout() } catch { /* ignore */ }
  store.logout()
  router.push('/login')
}
</script>

<template>
  <AdminLayout>
    <div class="page-header"><h2>个人设置</h2></div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span>基本信息</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户名">{{ store.userInfo?.username || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ store.userInfo?.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ store.userInfo?.phone || '未绑定' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ store.userInfo?.email || '未绑定' }}</el-descriptions-item>
            <el-descriptions-item label="角色">
              <el-tag :type="store.roleCode === 'admin' ? 'danger' : 'primary'" size="small">{{ store.roleCode }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <div style="margin-top:16px;display:flex;gap:8px">
            <el-button type="primary" @click="openEdit">编辑资料</el-button>
            <el-button @click="pwdVisible = true">修改密码</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span>账号安全</span></template>
          <p style="color:#666;font-size:14px;line-height:1.8">
            建议定期修改密码以保障账号安全。<br/>
            如发现异常操作记录请联系系统管理员。
          </p>
          <el-button type="danger" plain @click="handleLogout" style="margin-top:12px">退出登录</el-button>
        </el-card>
      </el-col>
    </el-row>

    <!-- Edit Profile Dialog -->
    <el-dialog v-model="editVisible" title="编辑个人资料" width="440px">
      <el-form label-width="80px">
        <el-form-item label="昵称"><el-input v-model="editForm.nickname" placeholder="请输入昵称" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="editForm.phone" placeholder="请输入手机号" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="editForm.email" placeholder="请输入邮箱" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="handleEditSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- Change Password Dialog -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="440px">
      <el-form label-width="100px">
        <el-form-item label="旧密码"><el-input v-model="pwdForm.old_password" type="password" show-password placeholder="请输入旧密码" /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.new_password" type="password" show-password placeholder="至少6位" /></el-form-item>
        <el-form-item label="确认新密码"><el-input v-model="pwdForm.confirm_password" type="password" show-password placeholder="再次输入新密码" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="handlePwdSave">确认修改</el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>
