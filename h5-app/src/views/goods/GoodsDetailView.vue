<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGoodsDetailFull } from '@/api/goods'
import type { GoodsItem, GoodsDetailResponse } from '@/api/goods'
import { addToCart } from '@/api/cart'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const userStore = useUserStore()

const detail = ref<GoodsDetailResponse | null>(null)
const goods = computed(() => detail.value?.spu || null)
const loading = ref(true)
const error = ref('')
const mainImage = ref('')
const quantity = ref(1)
const addingCart = ref(false)
const currentSku = ref<GoodsDetailResponse['skus'][0] | null>(null)

const selectedPrice = computed(() => currentSku.value?.price ?? goods.value?.min_price ?? 0)
const selectedStock = computed(() => currentSku.value?.stock ?? 0)
const isLowStock = computed(() => selectedStock.value > 0 && selectedStock.value <= 5)

function selectSku(sku: GoodsDetailResponse['skus'][0]) {
  currentSku.value = sku
  mainImage.value = sku.main_image || goods.value?.main_image || ''
  quantity.value = 1
}

function selectThumb(img: string) { mainImage.value = img }

async function loadDetail() {
  error.value = ''; loading.value = true
  try {
    const id = Number(route.params.id)
    detail.value = await getGoodsDetailFull(id)
    if (detail.value?.spu) {
      mainImage.value = detail.value.spu.main_image
      if (detail.value.skus?.length) selectSku(detail.value.skus[0])
    }
  } catch { error.value = '加载商品失败，请重试' } finally { loading.value = false }
}
onMounted(() => {
  watch(() => route.params.id, () => loadDetail(), { immediate: true })
})

async function handleAddCart() {
  if (!userStore.isLoggedIn) { router.push('/login'); return }
  if (!currentSku.value) { ElMessage.warning('请选择商品规格'); return }
  addingCart.value = true
  try {
    await addToCart({ sku_id: currentSku.value.id, quantity: quantity.value })
    cartStore.addCount(quantity.value)
    ElMessage.success('已加入购物车')
  } catch { /* interceptor handles */ } finally { addingCart.value = false }
}

async function handleBuy() {
  if (!userStore.isLoggedIn) { router.push('/login'); return }
  if (!currentSku.value) { ElMessage.warning('请选择商品规格'); return }
  addingCart.value = true
  try {
    await addToCart({ sku_id: currentSku.value.id, quantity: quantity.value })
    cartStore.addCount(quantity.value)
    router.push('/cart')
  } catch { /* interceptor handles */ } finally { addingCart.value = false }
}
</script>

<template>
  <div class="detail-page">
    <el-result v-if="error" icon="error" :title="error">
      <template #extra><el-button type="primary" @click="loadDetail">重试</el-button></template>
    </el-result>
    <el-empty v-else-if="!loading && !goods" description="商品不存在" />
    <el-skeleton v-else :loading="loading" animated>
      <template v-if="goods">
        <div class="detail-main">
          <!-- Gallery -->
          <div class="detail-gallery">
            <SafeImage :src="mainImage || goods.main_image" :alt="goods.name" width="100%" height="210" fit="cover" />
            <div class="gallery-thumbs" v-if="goods.images?.length">
              <div
                v-for="(img, i) in goods.images"
                :key="i"
                class="thumb-item"
                :class="{ active: mainImage === img }"
                @click="selectThumb(img)"
              >
                <SafeImage :src="img" :alt="goods.name" width="56" height="56" fit="cover" />
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="detail-info">
            <h1>{{ goods.name }}</h1>
            <p class="detail-subtitle" v-if="goods.subtitle">{{ goods.subtitle }}</p>

            <div class="detail-price-row">
              <span class="price price-lg">&yen;{{ formatPrice(selectedPrice) }}</span>
              <span v-if="currentSku?.original_price && currentSku.original_price > selectedPrice" class="price-original">
                &yen;{{ formatPrice(currentSku.original_price) }}
              </span>
              <span class="detail-sales">已售 {{ goods.sales }}</span>
            </div>

            <!-- SKU Selector -->
            <div class="detail-skus" v-if="detail?.skus?.length">
              <div class="sku-label">规格</div>
              <div class="sku-list">
                <div
                  v-for="sku in detail.skus"
                  :key="sku.id"
                  class="sku-item"
                  :class="{ active: currentSku?.id === sku.id }"
                  @click="selectSku(sku)"
                >
                  <SafeImage :src="sku.main_image" alt="" width="32" height="32" fit="cover" radius="4" />
                  <span>&yen;{{ formatPrice(sku.price) }}</span>
                  <span class="sku-stock">库存: {{ sku.stock }}</span>
                </div>
              </div>
            </div>

            <!-- Stock -->
            <div class="detail-stock">
              <span v-if="selectedStock > 0 && !isLowStock" class="stock-ok">有货 ({{ selectedStock }} 件)</span>
              <span v-else-if="isLowStock" class="stock-low">仅剩 {{ selectedStock }} 件</span>
              <span v-else class="stock-out">暂时缺货</span>
            </div>

            <div class="detail-meta">
              <el-tag type="info">{{ goods.brand }}</el-tag>
              <span>编号: {{ goods.spu_code }}</span>
            </div>

            <div class="detail-qty">
              <span>数量</span>
              <el-input-number v-model="quantity" :min="1" :max="selectedStock || 99" :disabled="selectedStock === 0" />
            </div>

            <div class="detail-actions">
              <el-button size="large" @click="handleAddCart" :loading="addingCart" :disabled="selectedStock === 0">加入购物车</el-button>
              <el-button size="large" type="danger" @click="handleBuy" :loading="addingCart" :disabled="selectedStock === 0">立即购买</el-button>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="detail-desc">
          <h3>商品详情</h3>
          <p v-if="goods.subtitle">{{ goods.subtitle }}</p>
          <p>品牌: {{ goods.brand }} | 编号: {{ goods.spu_code }}</p>
          <div v-if="goods.detail_html" v-html="goods.detail_html" />
          <p v-else>此商品为靶机测试商品，仅供学习和自动化练习使用。</p>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<style scoped>
.detail-page { max-width: 1200px; margin: 0 auto; }
.detail-main { display: flex; gap: 30px; background: #fff; padding: 24px; border-radius: 8px; margin-bottom: 16px; }
.detail-gallery { width: 460px; flex-shrink: 0; }
.gallery-thumbs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.thumb-item { border: 2px solid transparent; border-radius: 6px; cursor: pointer; overflow: hidden; transition: border-color .2s; }
.thumb-item.active { border-color: #ff6b35; }
.detail-info { flex: 1; }
.detail-info h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
.detail-subtitle { color: #999; font-size: 14px; margin: 0 0 16px; }
.detail-price-row { background: #fef0f0; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; display: flex; align-items: baseline; gap: 8px; }
.price-original { font-size: 13px; color: #999; text-decoration: line-through; }
.detail-sales { font-size: 12px; color: #bbb; margin-left: auto; }
.sku-label { font-size: 14px; color: #333; margin-bottom: 8px; }
.sku-list { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.sku-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid #dcdfe6; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all .2s; }
.sku-item:hover { border-color: #ff6b35; }
.sku-item.active { border-color: #ff6b35; background: #fff7f0; color: #ff6b35; }
.sku-stock { color: #c0c4cc; font-size: 11px; }
.detail-stock { margin-bottom: 12px; font-size: 13px; }
.stock-ok { color: #67c23a; }
.stock-low { color: #e6a23c; font-weight: 600; }
.stock-out { color: #f56c6c; }
.detail-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #909399; margin-bottom: 20px; }
.detail-qty { display: flex; align-items: center; gap: 12px; font-size: 14px; margin-bottom: 24px; }
.detail-actions { display: flex; gap: 12px; }
.detail-desc { background: #fff; padding: 24px; border-radius: 8px; }
.detail-desc h3 { font-size: 16px; margin-bottom: 12px; }
.detail-desc p { color: #666; font-size: 14px; line-height: 1.8; }
</style>
