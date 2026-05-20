<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

interface CouponTemplate {
  id: number; name: string; type: 'fixed' | 'percent'
  threshold: number; value: number; total_qty: number; used_qty: number
  start_time: string; end_time: string; status: number
}
interface UserCoupon {
  id: number; coupon_id: number; status: string
  coupon: CouponTemplate
}

const userStore = useUserStore()
const available = ref<CouponTemplate[]>([])
const myCoupons = ref<UserCoupon[]>([])
const loading = ref(false)
const claiming = ref(0)

async function loadData() {
  // Guard: avoid passing user_id='' to the API when userInfo isn't loaded yet.
  if (!userStore.userInfo?.id) { loading.value = false; return }
  loading.value = true
  try {
    const [avail, mine] = await Promise.all([
      request.get<CouponTemplate[]>('/sys/coupon/available'),
      request.get<UserCoupon[]>(`/user/coupons?user_id=${userStore.userInfo.id}`),
    ])
    available.value = Array.isArray(avail) ? avail : []
    myCoupons.value = Array.isArray(mine) ? mine : []
  } catch { ElMessage.error('加载优惠券失败') } finally { loading.value = false }
}

async function claim(couponId: number) {
  if (!userStore.userInfo?.id) { ElMessage.warning('请先登录'); return }
  claiming.value = couponId
  try {
    await request.post('/user/coupon/claim', { user_id: userStore.userInfo.id, coupon_id: couponId })
    ElMessage.success('领取成功')
    loadData()
  } catch { ElMessage.error('领取失败') } finally { claiming.value = 0 }
}

function fmtVal(c: CouponTemplate) {
  return c.type === 'fixed' ? `¥${(c.value / 100).toFixed(0)}` : `${(c.value / 10).toFixed(1)}折`
}
function fmtThreshold(c: CouponTemplate) {
  return c.type === 'fixed' && c.threshold > 0 ? `满¥${(c.threshold / 100).toFixed(0)}可用` : '无门槛'
}

onMounted(loadData)
</script>

<template>
  <div class="coupon-page">
    <div class="page-header"><h2>领券中心</h2></div>

    <div v-loading="loading">
      <h3 style="margin-bottom:14px">可领优惠券</h3>
      <div class="coupon-grid" v-if="available.length > 0">
        <div v-for="c in available" :key="c.id" class="coupon-card">
          <div class="coupon-value">
            <span class="coupon-price">{{ fmtVal(c) }}</span>
            <span class="coupon-type">{{ c.type === 'fixed' ? '满减券' : '折扣券' }}</span>
          </div>
          <div class="coupon-info">
            <div class="coupon-name">{{ c.name }}</div>
            <div class="coupon-desc">{{ fmtThreshold(c) }}</div>
            <div class="coupon-time">{{ c.end_time?.slice(0, 10) }} 前有效</div>
          </div>
          <el-button type="danger" size="small" :loading="claiming === c.id" @click="claim(c.id)" style="flex-shrink:0">立即领取</el-button>
        </div>
      </div>
      <el-empty v-else description="暂无可领优惠券" />

      <h3 style="margin:24px 0 14px">我的优惠券</h3>
      <div class="coupon-grid" v-if="myCoupons.length > 0">
        <div v-for="uc in myCoupons" :key="uc.id" class="coupon-card" :class="{ used: uc.status !== 'unused' }">
          <div class="coupon-value">
            <span class="coupon-price">{{ fmtVal(uc.coupon) }}</span>
            <span class="coupon-type">{{ uc.coupon.type === 'fixed' ? '满减券' : '折扣券' }}</span>
          </div>
          <div class="coupon-info">
            <div class="coupon-name">{{ uc.coupon.name }}</div>
            <div class="coupon-desc">{{ fmtThreshold(uc.coupon) }}</div>
            <div class="coupon-time" v-if="uc.status === 'used'">已使用</div>
            <div class="coupon-time" v-else>{{ uc.coupon.end_time?.slice(0, 10) }} 前有效</div>
          </div>
          <el-tag v-if="uc.status === 'used'" type="info" size="small">已使用</el-tag>
        </div>
      </div>
      <el-empty v-else description="暂无优惠券" />
    </div>
  </div>
</template>

<style scoped>
.coupon-page { max-width: 900px; margin: 0 auto; padding: 20px 0; }
.coupon-grid { display: flex; flex-direction: column; gap: 12px; }
.coupon-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: #fff; border-radius: 8px; border: 1px solid #f0f0f0; }
.coupon-card.used { opacity: 0.5; }
.coupon-value { display: flex; flex-direction: column; align-items: center; min-width: 80px; padding-right: 16px; border-right: 1px dashed #e8e8e8; }
.coupon-price { font-size: 24px; font-weight: 700; color: #f56c6c; }
.coupon-type { font-size: 11px; color: #999; }
.coupon-info { flex: 1; }
.coupon-name { font-size: 15px; font-weight: 500; margin-bottom: 4px; }
.coupon-desc { font-size: 12px; color: #999; }
.coupon-time { font-size: 11px; color: #c0c4cc; margin-top: 4px; }
</style>
