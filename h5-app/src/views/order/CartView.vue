<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCartList, updateCartItem, removeCartItems, toggleCartItems, toggleSelectAll } from '@/api/cart'
import { useCartStore } from '@/stores/cart'
import type { CartItem } from '@/api/cart'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const cartStore = useCartStore()

const items = ref<CartItem[]>([])
const loading = ref(false)
const error = ref('')

const selectedItems = computed(() => items.value.filter((i) => i.checked))
const totalPrice = computed(() => selectedItems.value.reduce((s, i) => s + i.price * i.quantity, 0))
const isAllSelected = computed(() => items.value.length > 0 && items.value.every((i) => i.checked))

async function loadCart() {
  loading.value = true; error.value = ''
  try {
    items.value = await getCartList()
    cartStore.setCount(items.value.reduce((s, i) => s + i.quantity, 0))
  } catch { error.value = '加载购物车失败，请重试' } finally {
    loading.value = false
  }
}

async function onToggleSelect(item: CartItem) {
  try { await toggleCartItems([item.id], !item.checked); item.checked = !item.checked } catch { /* ignore */ }
}
async function onToggleAll() {
  try { await toggleSelectAll(!isAllSelected.value); items.value.forEach(i => i.checked = !isAllSelected.value) } catch { /* ignore */ }
}
async function onQtyChange(item: CartItem, qty: number | undefined) {
  if (!qty || qty < 1) { qty = 1 }
  if (item.stock > 0 && qty > item.stock) {
    ElMessage.warning(`库存不足，最多可购买 ${item.stock} 件`)
    qty = item.stock
  }
  const prevQty = item.quantity
  item.quantity = qty
  try {
    await updateCartItem(item.id, { quantity: qty })
    cartStore.setCount(items.value.reduce((s, i) => s + i.quantity, 0))
  } catch {
    item.quantity = prevQty
  }
}
async function onDeleteItem(item: CartItem) {
  try { await ElMessageBox.confirm('确定删除该商品吗？', '提示', { type: 'warning' }) } catch { return }
  try { await removeCartItems([item.id]); items.value = items.value.filter(i => i.id !== item.id); cartStore.setCount(items.value.reduce((s, i) => s + i.quantity, 0)); ElMessage.success('已删除') } catch { /* ignore */ }
}
async function onClearInvalid() {
  const invalidIds = items.value.filter(i => i.stock === 0 || i.stock < 0).map(i => i.id)
  if (invalidIds.length === 0) { ElMessage.info('没有失效商品'); return }
  try { await removeCartItems(invalidIds); ElMessage.success('已清理'); loadCart() } catch { /* ignore */ }
}
function onCheckout() {
  if (selectedItems.value.length === 0) { ElMessage.warning('请选择商品'); return }
  const orderItems = selectedItems.value.map(i => ({ sku_id: i.sku_id, spu_id: i.spu_id, quantity: i.quantity, price: i.price, goods_title: i.spu_name, goods_image: i.main_image }))
  const cartItemIds = selectedItems.value.map(i => i.id)
  sessionStorage.setItem('checkout_items', JSON.stringify(orderItems))
  sessionStorage.setItem('checkout_cart_ids', JSON.stringify(cartItemIds))
  router.push({ name: 'order-confirm' })
}

onMounted(loadCart)
</script>

<template>
  <div class="cart-page">
    <div class="page-header"><h2>购物车</h2></div>

    <el-result v-if="error" icon="error" :title="error" style="margin-top:20px">
      <template #extra><el-button type="primary" @click="loadCart">重试</el-button></template>
    </el-result>
    <el-empty v-else-if="!loading && items.length === 0" description="购物车空空如也" />

    <template v-else>
      <div class="cart-table-wrap" v-loading="loading">
        <table class="cart-table">
          <thead>
            <tr>
              <th style="width:50px">
                <el-checkbox :model-value="isAllSelected" @change="onToggleAll" />
              </th>
              <th>商品</th>
              <th style="width:120px">单价</th>
              <th style="width:140px">数量</th>
              <th style="width:120px">小计</th>
              <th style="width:80px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td><el-checkbox :model-value="item.checked" @change="onToggleSelect(item)" /></td>
              <td>
                <div class="cart-goods" @click="$router.push(`/goods/${item.spu_id}`)" style="cursor:pointer">
                  <SafeImage :src="item.main_image" :alt="item.spu_name" width="72" height="72" fit="cover" />
                  <span class="ellipsis" style="max-width:240px">{{ item.spu_name }}</span>
                </div>
              </td>
              <td><span class="price price-sm">&yen;{{ formatPrice(item.price) }}</span></td>
              <td>
                <el-input-number :model-value="item.quantity" :min="1" :max="item.stock || 99" size="small" @update:model-value="(v: number|undefined) => onQtyChange(item, v)" />
                <div v-if="item.stock > 0" style="font-size:11px;margin-top:2px" :style="{ color: item.quantity >= item.stock ? '#f56c6c' : '#909399' }">
                  库存 {{ item.stock }} 件<span v-if="item.quantity >= item.stock">（已达上限）</span>
                </div>
              </td>
              <td><span class="price price-sm">&yen;{{ formatPrice(item.price * item.quantity) }}</span></td>
              <td><el-button type="danger" link @click="onDeleteItem(item)">删除</el-button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="cart-bottom-bar">
        <div class="cart-bottom__left">
          <el-button link @click="onClearInvalid">清理失效商品</el-button>
        </div>
        <div class="cart-bottom__right">
          <span>已选 <b>{{ selectedItems.length }}</b> 件，合计:</span>
          <span class="price price-lg">&yen;{{ formatPrice(totalPrice) }}</span>
          <el-button type="danger" size="large" @click="onCheckout" :disabled="selectedItems.length === 0">
            去结算
          </el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cart-page { max-width: 1200px; margin: 0 auto; }
.cart-table-wrap { background: #fff; border-radius: 8px; overflow: hidden; }
.cart-table { width: 100%; border-collapse: collapse; }
.cart-table th { background: #fafafa; padding: 12px 16px; text-align: left; font-weight: 500; color: #909399; font-size: 13px; }
.cart-table td { padding: 14px 16px; border-bottom: 1px solid #f5f5f5; }
.cart-goods { display: flex; align-items: center; gap: 12px; }
.cart-bottom-bar { display: flex; justify-content: space-between; align-items: center; background: #fff; margin-top: 16px; padding: 14px 20px; border-radius: 8px; }
.cart-bottom__right { display: flex; align-items: center; gap: 12px; font-size: 14px; }
</style>
