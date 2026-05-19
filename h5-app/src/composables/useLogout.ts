import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { logout as apiLogout } from '@/api/user'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useLogout() {
  const router = useRouter()
  const userStore = useUserStore()

  async function handleLogout() {
    try {
      await ElMessageBox.confirm('确定退出登录吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    } catch { return }
    try { await apiLogout() } catch { /* ignore */ }
    userStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }

  return { handleLogout }
}
