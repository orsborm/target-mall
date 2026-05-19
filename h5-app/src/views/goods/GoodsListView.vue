<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGoodsList, getCategoryTree } from '@/api/goods'
import type { GoodsItem, GoodsCategory, GoodsListParams } from '@/api/goods'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const goodsList = ref<GoodsItem[]>([])
const categories = ref<GoodsCategory[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const activeCategory = ref<number>(Number(route.query.category_id) || 0)
const sortBy = ref('')
const keyword = ref((route.query.keyword as string) || '')
const pageSize = 20

async function loadCategories() {
  try { categories.value = await getCategoryTree() } catch { error.value = '加载分类失败' }
}

async function loadGoods(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; goodsList.value = [] }
  loading.value = true; error.value = ''
  try {
    const res = await getGoodsList({
      page: page.value,
      page_size: pageSize,
      ...(activeCategory.value > 0 ? { category_id: activeCategory.value } : {}),
      ...(sortBy.value ? { sort: sortBy.value as GoodsListParams['sort'] } : {}),
      ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
    })
    if (reset) goodsList.value = res.list
    else goodsList.value.push(...res.list)
    total.value = res.total
  } catch { error.value = '加载商品失败，请重试' } finally {
    loading.value = false
  }
}

function changePage(p: number) { page.value = p; loadGoods(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function changeCategory(id: number) { activeCategory.value = id; router.replace({ query: id > 0 ? { category_id: id } : {} }); loadGoods(true) }
function changeSort(s: string) { sortBy.value = s; loadGoods(true) }

onMounted(() => { loadCategories(); loadGoods(true) })
watch(() => route.query.category_id, (v) => {
  const id = Number(v) || 0
  if (id !== activeCategory.value) { activeCategory.value = id; loadGoods(true) }
})
</script>

<template>
  <div class="goods-list-page">
    <div class="page-header">
      <h2>全部商品</h2>
      <span class="total-info">共 {{ total }} 件商品</span>
    </div>

    <!-- Category + Sort Bar -->
    <div class="filter-bar">
      <div class="filter-left">
        <el-radio-group v-model="activeCategory" size="small" @change="(v: number) => changeCategory(v)">
          <el-radio-button :value="0">全部</el-radio-button>
          <el-radio-button v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="filter-right">
        <el-radio-group v-model="sortBy" size="small" @change="(v: string) => changeSort(v)">
          <el-radio-button value="">综合</el-radio-button>
          <el-radio-button value="sales_desc">销量</el-radio-button>
          <el-radio-button value="price_asc">价格↑</el-radio-button>
          <el-radio-button value="price_desc">价格↓</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- Product Grid -->
    <el-result v-if="error" icon="error" :title="error">
      <template #extra><el-button type="primary" @click="loadGoods(true);loadCategories()">重试</el-button></template>
    </el-result>
    <div v-loading="loading" v-else-if="goodsList.length > 0 || loading">
      <div class="goods-grid">
        <div v-for="g in goodsList" :key="g.id" class="goods-card card-hover" @click="$router.push(`/goods/${g.id}`)">
          <SafeImage :src="g.main_image" :alt="g.name" width="100%" height="110" fit="cover" />
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

      <!-- Pagination -->
      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="changePage"
        />
      </div>
    </div>

    <el-empty v-else-if="!loading" description="暂无商品" />
  </div>
</template>

<style scoped>
.goods-list-page {
  max-width: 1200px;
  margin: 0 auto;
}
.total-info {
  font-size: 13px;
  color: #999;
}
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
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
.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
