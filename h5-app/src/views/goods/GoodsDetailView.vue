<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGoodsDetailFull, getComments, postComment, toggleFavoriteApi } from '@/api/goods'
import type { GoodsItem, GoodsDetailResponse, CommentItem } from '@/api/goods'
import { addToCart } from '@/api/cart'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'
import { ElMessage } from 'element-plus'
import { Star, ChatDotRound, StarFilled } from '@element-plus/icons-vue'

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
    if (isNaN(id) || id <= 0) { error.value = '无效的商品ID'; loading.value = false; return }
    detail.value = await getGoodsDetailFull(id)
    if (detail.value?.spu) {
      mainImage.value = detail.value.spu.main_image
      if (detail.value.skus?.length) selectSku(detail.value.skus[0])
    }
  } catch { error.value = '加载商品失败，请重试' } finally { loading.value = false }
}
// ---- Favorite state ----
const isFav = ref(false)
const favLoading = ref(false)
async function toggleFav() {
  if (!userStore.isLoggedIn) { router.push('/login'); return }
  if (!goods.value) return
  const uid = userStore.userInfo?.id
  if (!uid) { ElMessage.warning('请先登录'); return }
  favLoading.value = true
  try {
    const res = await toggleFavoriteApi(uid, goods.value.id)
    isFav.value = res.favorited
    ElMessage.success(res.favorited ? '已收藏' : '已取消收藏')
  } catch { /* ignore */ } finally { favLoading.value = false }
}

// ---- Reviews state ----
const descTab = ref<'desc' | 'reviews'>('desc')
const comments = ref<CommentItem[]>([])
const commentTotal = ref(0)
const avgRating = ref(0)
const commentPage = ref(1)
const commentLoading = ref(false)
const showReviewForm = ref(false)
const reviewForm = ref({ rating: 5, content: '' })
const submittingReview = ref(false)

async function loadComments(reset = false) {
  if (!goods.value) return
  if (reset) { commentPage.value = 1; comments.value = [] }
  commentLoading.value = true
  try {
    const res = await getComments(goods.value.id, { page: commentPage.value, page_size: 10 })
    comments.value = reset ? res.list : [...comments.value, ...res.list]
    commentTotal.value = res.total; avgRating.value = res.avgRating
  } catch { /* ignore */ } finally { commentLoading.value = false }
}

async function submitReview() {
  if (!reviewForm.value.content.trim()) { ElMessage.warning('请输入评价内容'); return }
  if (!goods.value || !userStore.userInfo) return
  submittingReview.value = true
  try {
    await postComment({ spu_id: goods.value.id, user_id: userStore.userInfo.id, username: userStore.userInfo.nickname || userStore.userInfo.username, rating: reviewForm.value.rating, content: reviewForm.value.content.trim() })
    ElMessage.success('评价提交成功')
    showReviewForm.value = false; reviewForm.value = { rating: 5, content: '' }
    loadComments(true)
  } catch { ElMessage.error('提交评价失败') } finally { submittingReview.value = false }
}

onMounted(() => {
  watch(() => route.params.id, () => { loadDetail(); loadComments(true) }, { immediate: true })
})

async function handleCartAction(redirectToCart: boolean) {
  if (!userStore.isLoggedIn) { router.push('/login'); return }
  if (!currentSku.value) { ElMessage.warning('请选择商品规格'); return }
  addingCart.value = true
  try {
    await addToCart({ sku_id: currentSku.value.id, quantity: quantity.value })
    cartStore.addCount(quantity.value)
    if (redirectToCart) { router.push('/cart') } else { ElMessage.success('已加入购物车') }
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
            <div style="display:flex;align-items:center;gap:8px">
              <h1 style="flex:1">{{ goods.name }}</h1>
              <el-button :icon="StarFilled" :type="isFav ? 'warning' : 'default'" circle size="small" :loading="favLoading" @click="toggleFav" :style="{ color: isFav ? '#e6a23c' : '#c0c4cc' }" />
            </div>
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
                  :class="{ active: currentSku?.id === sku.id, 'sku-oos': sku.stock === 0 }"
                  @click="sku.stock > 0 && selectSku(sku)"
                >
                  <SafeImage :src="sku.main_image" alt="" width="32" height="32" fit="cover" radius="4" />
                  <span>&yen;{{ formatPrice(sku.price) }}</span>
                  <span class="sku-stock" :class="{ 'sku-stock-zero': sku.stock === 0 }">{{ sku.stock === 0 ? '缺货' : `库存: ${sku.stock}` }}</span>
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
              <el-button size="large" @click="handleCartAction(false)" :loading="addingCart" :disabled="selectedStock === 0">加入购物车</el-button>
              <el-button size="large" type="danger" @click="handleCartAction(true)" :loading="addingCart" :disabled="selectedStock === 0">立即购买</el-button>
            </div>
          </div>
        </div>

        <!-- Description & Reviews Tabs -->
        <div class="detail-desc">
          <div class="desc-tabs">
            <span :class="{ active: descTab === 'desc' }" @click="descTab = 'desc'">商品详情</span>
            <span :class="{ active: descTab === 'reviews' }" @click="descTab = 'reviews'; loadComments(true)">
              商品评价{{ avgRating > 0 ? ` (${avgRating}分)` : '' }}
            </span>
          </div>

          <template v-if="descTab === 'desc'">
            <p v-if="goods.subtitle">{{ goods.subtitle }}</p>
            <p>品牌: {{ goods.brand }} | 编号: {{ goods.spu_code }}</p>
            <div v-if="goods.detail_html" v-text="goods.detail_html" />
            <p v-else>此商品为靶机测试商品，仅供学习和自动化练习使用。</p>
          </template>

          <template v-else>
            <div v-if="avgRating > 0" style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
              <span style="font-size:24px;font-weight:700;color:#f56c6c">{{ avgRating }}</span>
              <span style="color:#999;font-size:13px">{{ commentTotal }} 条评价</span>
              <el-button size="small" :icon="ChatDotRound" @click="showReviewForm = !showReviewForm" style="margin-left:auto">写评价</el-button>
            </div>
            <div v-else style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
              <span style="color:#999;font-size:14px">暂无评价</span>
              <el-button size="small" :icon="ChatDotRound" @click="showReviewForm = !showReviewForm" style="margin-left:auto">写评价</el-button>
            </div>

            <div v-if="showReviewForm" style="padding:14px;background:#fafafa;border-radius:8px;margin-bottom:14px">
              <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
                <span style="font-size:13px">评分:</span>
                <el-rate v-model="reviewForm.rating" :max="5" size="small" />
              </div>
              <el-input v-model="reviewForm.content" type="textarea" :rows="3" placeholder="分享你的使用体验..." style="margin-bottom:8px" />
              <el-button type="primary" size="small" :loading="submittingReview" @click="submitReview">提交评价</el-button>
            </div>

            <div v-if="comments.length > 0">
              <div v-for="c in comments" :key="c.id" style="padding:12px 0;border-bottom:1px solid #f5f5f5">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-weight:500;font-size:13px">{{ c.username }}</span>
                  <el-rate :model-value="c.rating" :max="5" size="small" disabled show-score style="height:20px" />
                  <span style="color:#999;font-size:11px;margin-left:auto">{{ c.created_at?.slice(0, 10) }}</span>
                </div>
                <p style="font-size:13px;color:#333;margin:0">{{ c.content }}</p>
              </div>
              <div v-if="comments.length < commentTotal" style="text-align:center;margin-top:12px">
                <el-button text type="primary" :loading="commentLoading" @click="commentPage++; loadComments(false)">加载更多评价 ({{ commentTotal - comments.length }} 条)</el-button>
              </div>
            </div>
            <el-empty v-if="!commentLoading && comments.length === 0 && !showReviewForm" description="还没有评价，快来写第一条吧" />
          </template>
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
.sku-stock-zero { color: #f56c6c; }
.sku-oos { opacity: 0.45; cursor: not-allowed; }
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
.desc-tabs { display: flex; gap: 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 20px; }
.desc-tabs span { padding: 10px 24px; cursor: pointer; font-size: 15px; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .2s; }
.desc-tabs span:hover { color: #ff6b35; }
.desc-tabs span.active { color: #ff6b35; border-bottom-color: #ff6b35; font-weight: 600; }
</style>
