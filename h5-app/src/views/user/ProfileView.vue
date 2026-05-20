<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getUserInfo, updateProfile } from '@/api/user'
import { getUnreadCount } from '@/api/msg'
import type { UserInfo } from '@/api/user'
import { ElMessage } from 'element-plus'
import { useLogout } from '@/composables/useLogout'
import { Tickets, Location, Bell, ChatDotRound, Monitor } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const info = ref<UserInfo | null>(null)
const error = ref('')
const unreadCount = ref(0)
const showEdit = ref(false)
const editForm = ref({ nickname: '', phone: '', email: '' })
const saving = ref(false)

async function loadInfo() {
  if (!userStore.isLoggedIn) { router.push('/login'); return }
  error.value = ''
  try {
    const [profile, unread] = await Promise.all([
      getUserInfo(),
      getUnreadCount().catch(() => ({ count: 0 })),
    ])
    info.value = profile; userStore.setUserInfo(profile); unreadCount.value = unread.count
  } catch {
    ElMessage.error('加载个人信息失败')
    info.value = userStore.userInfo
    if (!info.value) error.value = '加载个人信息失败，请重试'
  }
}
onMounted(loadInfo)

function openEdit() {
  if (!info.value) return
  editForm.value = { nickname: info.value.nickname, phone: info.value.phone, email: info.value.email }
  showEdit.value = true
}

const phoneRe = /^1\d{10}$/
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function handleSave() {
  if (!editForm.value.nickname.trim()) { ElMessage.warning('昵称不能为空'); return }
  if (editForm.value.phone.trim() && !phoneRe.test(editForm.value.phone.trim())) { ElMessage.warning('手机号格式不正确'); return }
  if (editForm.value.email.trim() && !emailRe.test(editForm.value.email.trim())) { ElMessage.warning('邮箱格式不正确'); return }
  saving.value = true
  try {
    await updateProfile({ nickname: editForm.value.nickname.trim(), phone: editForm.value.phone.trim(), email: editForm.value.email.trim() })
    ElMessage.success('保存成功'); showEdit.value = false
    if (info.value) { info.value.nickname = editForm.value.nickname; info.value.phone = editForm.value.phone; info.value.email = editForm.value.email }
  } catch { ElMessage.error('保存个人信息失败') } finally { saving.value = false }
}

const { handleLogout } = useLogout()
</script>

<template>
  <div class="profile-page">
    <div class="page-header"><h2>个人中心</h2></div>

    <el-result v-if="error" icon="error" :title="error">
      <template #extra><el-button type="primary" @click="loadInfo">重试</el-button></template>
    </el-result>
    <div v-else class="profile-grid">
      <div class="profile-card">
        <div class="profile-avatar">
          <el-avatar :size="72" :src="info?.avatar">{{ (info?.nickname || info?.username || 'U')[0] }}</el-avatar>
          <div>
            <h3>{{ info?.nickname || info?.username || '-' }}</h3>
            <p>{{ info?.phone || '未绑定手机' }}</p>
          </div>
        </div>
        <el-divider />
        <div class="profile-info">
          <div class="info-row"><span>用户名</span><span>{{ info?.username }}</span></div>
          <div class="info-row"><span>邮箱</span><span>{{ info?.email || '-' }}</span></div>
          <div class="info-row"><span>角色</span><el-tag size="small">{{ info?.role_code }}</el-tag></div>
          <div class="info-row"><span>注册时间</span><span>{{ info?.created_at?.slice(0, 10) }}</span></div>
        </div>
        <el-button type="primary" @click="openEdit" style="width:100%;margin-top:16px">编辑资料</el-button>
      </div>

      <div class="profile-links">
        <div class="link-card" @click="$router.push('/order/list')">
          <el-icon :size="28" color="#409eff"><Tickets /></el-icon>
          <span>我的订单</span>
        </div>
        <div class="link-card" @click="$router.push('/user/address')">
          <el-icon :size="28" color="#67c23a"><Location /></el-icon>
          <span>收货地址</span>
        </div>
        <div class="link-card" @click="$router.push('/user/notifications')">
          <el-badge :value="unreadCount" :hidden="unreadCount <= 0">
            <el-icon :size="28" color="#e6a23c"><Bell /></el-icon>
          </el-badge>
          <span>消息通知</span>
        </div>
        <div class="link-card" @click="$router.push('/feedback')">
          <el-icon :size="28" color="#f56c6c"><ChatDotRound /></el-icon>
          <span>意见反馈</span>
        </div>
        <div class="link-card" @click="$router.push('/system/logs')">
          <el-icon :size="28" color="#909399"><Monitor /></el-icon>
          <span>日志管理</span>
        </div>
      </div>
    </div>

    <el-button v-if="!error" type="danger" plain @click="handleLogout" style="margin-top:20px">退出登录</el-button>

    <!-- Edit Dialog -->
    <el-dialog v-model="showEdit" title="编辑资料" width="460px">
      <el-form label-width="80px">
        <el-form-item label="昵称"><el-input v-model="editForm.nickname" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="editForm.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="editForm.email" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.profile-page { max-width: 900px; margin: 0 auto; }
.profile-grid { display: flex; gap: 20px; }
.profile-card { flex: 1; background: #fff; padding: 24px; border-radius: 8px; }
.profile-avatar { display: flex; align-items: center; gap: 16px; }
.profile-avatar h3 { margin: 0; font-size: 18px; }
.profile-avatar p { margin: 4px 0 0; color: #999; font-size: 13px; }
.info-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; color: #666; }
.profile-links { width: 320px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.link-card { background: #fff; border-radius: 8px; padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: box-shadow .2s; font-size: 14px; }
.link-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.08); }
</style>
