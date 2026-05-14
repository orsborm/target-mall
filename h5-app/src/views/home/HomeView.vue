<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getGoodsList, getRecommendGoods } from '@/api/goods'
import { getPageConfig } from '@/api/common'
import { useAppStore } from '@/stores/app'
import type { GoodsItem } from '@/api/goods'
import type { PageConfig } from '@/stores/app'
import { Goods } from '@element-plus/icons-vue'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'

const appStore = useAppStore()
const goodsList = ref<GoodsItem[]>([])
const loading = ref(false)
const error = ref('')
const banners = ref<string[]>([])

const homeTitle = computed(() => appStore.getConfigValue('home_title') || 'H5靶机商城')
const homeSubtitle = computed(() => appStore.getConfigValue('home_subtitle') || '安全练习 | 自动化练手 | 不断进化')

async function loadHome() {
  loading.value = true; error.value = ''
  try {
    const [configs, recommend] = await Promise.all([
      getPageConfig('home'),
      getRecommendGoods({ page_size: 8 }).catch(() => [] as GoodsItem[]),
    ])
    appStore.setPageConfigs(configs as unknown as PageConfig[])
    const imgConfigs = configs.filter((c: { type: string }) => c.type === 'image')
    banners.value = imgConfigs.map((c: { value: string }) => c.value)
    goodsList.value = recommend.length > 0 ? recommend : []
  } catch { error.value = '加载首页失败，请刷新重试' } finally {
    loading.value = false
  }
}
onMounted(loadHome)
</script>

<template>
  <div class="home-page">
    <!-- Banner Carousel -->
    <el-carousel v-if="banners.length > 0" :interval="4000" height="180px" class="home-banner">
      <el-carousel-item v-for="(img, i) in banners" :key="i">
        <SafeImage :src="img" width="100%" height="180" fit="cover" alt="banner" />
      </el-carousel-item>
    </el-carousel>
    <div v-else class="home-banner-fallback">
      <div class="banner-text">
        <h1>{{ homeTitle }}</h1>
        <p>{{ homeSubtitle }}</p>
      </div>
    </div>

    <!-- Category Quick Nav -->
    <div class="home-cats">
      <div
        v-for="cat in ['数码产品', '服饰鞋包', '食品生鲜', '家居日用']"
        :key="cat"
        class="cat-item card-hover"
        @click="$router.push('/goods/list')"
      >
        <el-icon :size="36" color="#ff6b35"><Goods /></el-icon>
        <span>{{ cat }}</span>
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
