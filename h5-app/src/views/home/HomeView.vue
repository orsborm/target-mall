<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecommendGoods, getCategoryTree } from '@/api/goods'
import { getPageConfig } from '@/api/common'
import { useAppStore } from '@/stores/app'
import type { GoodsItem, GoodsCategory } from '@/api/goods'
import type { PageConfig } from '@/stores/app'
import { Goods } from '@element-plus/icons-vue'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import { useUserStore } from '@/stores/user'

interface CouponCard { id: number; name: string; type: 'fixed' | 'percent'; threshold: number; value: number; end_time: string }

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const goodsList = ref<GoodsItem[]>([])
const loading = ref(false)
const error = ref('')
const coupons = ref<CouponCard[]>([])
const claimingCid = ref(0)
const homeCategories = ref<GoodsCategory[]>([])

interface CarouselSlide { type: 'image' | 'text'; value: string; link: string; label: string }
const slides = ref<CarouselSlide[]>([])

const homeTitle = computed(() => appStore.getConfigValue('home_title') || '')
const homeSubtitle = computed(() => appStore.getConfigValue('home_subtitle') || '')

async function loadHome() {
  loading.value = true; error.value = ''
  try {
    const [configs, recommend] = await Promise.all([
      getPageConfig('home'),
      getRecommendGoods({ page_size: 8 }).catch(() => [] as GoodsItem[]),
    ])
    appStore.setPageConfigs(configs as unknown as PageConfig[])
    // 所有 image + text (排除 title/subtitle) 都进入轮播
    slides.value = configs
      .filter((c) => c.type === 'image' || (c.type === 'text' && c.key !== 'home_title' && c.key !== 'home_subtitle'))
      .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0))
      .map((c) => ({ type: c.type as 'image' | 'text', value: c.value, link: c.link || '', label: c.label || '' }))
    goodsList.value = recommend.length > 0 ? recommend : []
  } catch { error.value = '加载首页失败，请刷新重试' } finally {
    loading.value = false
  }
}
function onSlideClick(item: CarouselSlide) {
  if (!item.link) return
  if (item.link.startsWith('http')) { window.open(item.link, '_blank'); return }
  if (item.link.startsWith('/')) { router.push(item.link); return }
}
async function loadCoupons() {
  try { const res: any = await request.get('/sys/coupon/available'); coupons.value = (Array.isArray(res) ? res : []).slice(0, 3) } catch { /* non-critical */ }
}
async function claimCoupon(couponId: number) {
  if (!userStore.userInfo?.id) { ElMessage.warning('请先登录'); return }
  claimingCid.value = couponId
  try {
    await request.post('/user/coupon/claim', { user_id: userStore.userInfo.id, coupon_id: couponId })
    ElMessage.success('领取成功')
    coupons.value = coupons.value.filter(c => c.id !== couponId)
  } catch { ElMessage.error('领取失败') } finally { claimingCid.value = 0 }
}
async function loadCategories() {
  try { homeCategories.value = await getCategoryTree() } catch { /* use hardcoded fallback below */ }
}
function fmtCVal(c: CouponCard) { return c.type === 'fixed' ? `¥${(c.value / 100).toFixed(0)}` : `${(c.value / 10).toFixed(1)}折` }
onMounted(() => { loadHome(); loadCoupons(); loadCategories() })
</script>

<template>
  <div class="home-page">
    <!-- Page Header -->
    <div class="home-banner-fallback" v-if="homeTitle">
      <div class="banner-text">
        <h1>{{ homeTitle }}</h1>
        <p v-if="homeSubtitle">{{ homeSubtitle }}</p>
      </div>
    </div>

    <!-- Carousel (images + text slides) -->
    <el-carousel v-if="slides.length > 0" :interval="4000" height="200px" class="home-banner">
      <el-carousel-item v-for="(item, i) in slides" :key="i">
        <!-- Image slide -->
        <img
          v-if="item.type === 'image'"
          :src="item.value"
          :alt="item.label"
          class="slide-img"
          :style="{ cursor: item.link ? 'pointer' : 'default' }"
          @click="onSlideClick(item)"
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <!-- Text slide -->
        <div
          v-else
          class="slide-text"
          :style="{ cursor: item.link ? 'pointer' : 'default' }"
          @click="onSlideClick(item)"
        >
          <span v-if="item.label" class="slide-text-label">{{ item.label }}</span>
          <p class="slide-text-value">{{ item.value }}</p>
          <span v-if="item.link" class="slide-text-link">点击查看 →</span>
        </div>
      </el-carousel-item>
    </el-carousel>

    <!-- Category Quick Nav -->
    <div class="home-cats">
      <!-- Fallback object includes all GoodsCategory fields so property
           access (e.g. .icon, .parent_id) never hits undefined -->
      <div
        v-for="cat in (homeCategories.length > 0 ? homeCategories : [{ id: 0, name: '全部商品', icon: '', parent_id: 0, level: 1, sort_order: 0 }])"
        :key="cat.id"
        class="cat-item card-hover"
        @click="$router.push(cat.id > 0 ? `/goods/list?category_id=${cat.id}` : '/goods/list')"
      >
        <el-icon :size="36" color="#ff6b35"><Goods /></el-icon>
        <span>{{ cat.name }}</span>
      </div>
    </div>

    <!-- Coupon Quick Claim -->
    <div v-if="coupons.length > 0" class="home-coupons">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h3 style="font-size:16px;margin:0">领券中心</h3>
        <el-button text type="primary" size="small" @click="$router.push('/user/coupons')">查看更多 →</el-button>
      </div>
      <div class="home-coupon-row">
        <div v-for="c in coupons" :key="c.id" class="home-coupon-card" @click="claimCoupon(c.id)">
          <div class="hcc-left">
            <span class="hcc-val">{{ fmtCVal(c) }}</span>
            <span class="hcc-type">{{ c.type === 'fixed' ? '满减券' : '折扣券' }}</span>
          </div>
          <div class="hcc-right">
            <span class="hcc-name">{{ c.name }}</span>
            <span class="hcc-desc">{{ c.type === 'fixed' && c.threshold > 0 ? `满¥${(c.threshold/100).toFixed(0)}可用` : '无门槛' }}</span>
            <span class="hcc-time">{{ c.end_time?.slice(0,10) }}前有效</span>
          </div>
          <el-button type="danger" size="small" :loading="claimingCid === c.id" @click.stop="claimCoupon(c.id)" class="hcc-btn">领取</el-button>
        </div>
      </div>
    </div>

    <el-result v-if="error" icon="error" :title="error" style="margin-top:20px">
      <template #extra><el-button type="primary" @click="loadHome">重试</el-button></template>
    </el-result>
    <!-- Hot Products -->
    <div class="page-header">
      <h2>推荐商品</h2>
      <el-button text type="primary" @click="$router.push('/goods/list')">查看更多 →</el-button>
    </div>

    <el-skeleton :loading="loading" animated :count="4">
      <template #template>
        <div style="display:flex;gap:16px">
          <el-skeleton-item v-for="i in 4" :key="i" variant="rect" style="width:280px;height:320px" />
        </div>
      </template>
      <div class="goods-grid">
        <div v-for="g in goodsList.slice(0, 8)" :key="g.id" class="goods-card card-hover" @click="$router.push(`/goods/${g.id}`)">
          <SafeImage :src="g.main_image" :alt="g.name" width="100%" height="100" fit="cover" />
          <div class="goods-card__body">
            <div class="goods-card__name ellipsis">{{ g.name }}</div>
            <div class="goods-card__brand">{{ g.brand }}</div>
            <div class="goods-card__bottom">
              <span class="price price-md">&yen;{{ formatPrice(g.min_price) }}</span>
              <span class="goods-card__sales">已售 {{ g.sales }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-skeleton>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
}
.home-banner {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}
.home-banner-fallback {
  background: linear-gradient(135deg, #ff6b35, #ff8c5a);
  height: 200px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.banner-text {
  text-align: center;
  color: #fff;
}
.banner-text h1 { font-size: 28px; margin: 0; }
.banner-text p { margin: 8px 0 0; opacity: .9; font-size: 15px; }
.banner-img { width: 100%; height: 200px; object-fit: cover; display: block; }
.slide-img { width: 100%; height: 200px; object-fit: cover; display: block; }
.slide-text { width: 100%; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 30px; text-align: center; box-sizing: border-box; }
.slide-text-label { font-size: 11px; opacity: .7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
.slide-text-value { font-size: 22px; font-weight: 700; margin: 0; line-height: 1.4; }
.slide-text-link { font-size: 12px; opacity: .8; margin-top: 12px; }

.home-coupons { margin-bottom: 20px; }
.home-coupon-row { display: flex; gap: 12px; }
.home-coupon-card { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border-radius: 8px; cursor: pointer; transition: box-shadow .2s; position: relative; overflow: hidden; }
.home-coupon-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.home-coupon-card::before { content: ''; position: absolute; left: -8px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #f5f7fa; border-radius: 50%; }
.hcc-left { display: flex; flex-direction: column; align-items: center; min-width: 64px; padding: 0 8px; }
.hcc-val { font-size: 22px; font-weight: 700; color: #f56c6c; }
.hcc-type { font-size: 10px; color: #999; margin-top: 2px; }
.hcc-right { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hcc-name { font-size: 14px; font-weight: 500; }
.hcc-desc { font-size: 11px; color: #999; }
.hcc-time { font-size: 10px; color: #c0c4cc; }
.hcc-btn { flex-shrink: 0; }

.home-cats {
  display: flex;
  gap: 16px;
  margin-bottom: 30px;
}
.cat-item {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
}

.goods-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.goods-card__body {
  padding: 12px 14px 14px;
}
.goods-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
.goods-card__brand {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
.goods-card__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}
.goods-card__sales {
  font-size: 11px;
  color: #bbb;
}
</style>
