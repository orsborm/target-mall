<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createOrder } from '@/api/order'
import { getAddressList } from '@/api/user'
import type { Address } from '@/api/user'
import SafeImage from '@/components/SafeImage.vue'
import { formatPrice } from '@/utils/format'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

interface ConfirmItem { goods_id: number; quantity: number; price: number; goods_title: string; goods_image: string }
const items = ref<ConfirmItem[]>([])
const addresses = ref<Address[]>([])
const selectedAddress = ref<Address | null>(null)
const payMethod = ref<'wechat' | 'alipay'>('wechat')
const remark = ref('')
const submitting = ref(false)
const addrError = ref('')
const freight = computed(() => totalPrice.value >= 9900 ? 0 : 800)
const discount = ref(0)

const totalPrice = computed(() => items.value.reduce((s, i) => s + i.price * i.quantity, 0))
const payAmount = computed(() => totalPrice.value + freight.value - discount.value)

async function loadAddresses() {
  addrError.value = ''
  try {
    addresses.value = await getAddressList()
    selectedAddress.value = addresses.value.find(a => a.is_default) || addresses.value[0] || null
  } catch { addrError.value = '加载地址失败' }
}

onMounted(async () => {
  try { items.value = JSON.parse(sessionStorage.getItem('checkout_items') || '[]') } catch { items.value = [] }
  if (items.value.length === 0) { ElMessage.error('订单数据异常'); router.back(); return }
  loadAddresses()
})

function selectAddress(addr: Address) { selectedAddress.value = addr }

async function handleSubmit() {
  if (!selectedAddress.value) { ElMessage.warning('请选择收货地址'); return }
  const cartItemIds: number[] = JSON.parse(sessionStorage.getItem('checkout_cart_ids') || '[]')
  if (cartItemIds.length === 0) { ElMessage.error('订单数据异常'); return }
  submitting.value = true
  try {
    const res = await createOrder({
      cart_item_ids: cartItemIds,
      address_id: selectedAddress.value.id,
      pay_method: payMethod.value,
      remark: remark.value,
    })
    ElMessage.success('下单成功')
    sessionStorage.removeItem('checkout_items')
    sessionStorage.removeItem('checkout_cart_ids')
    router.replace(`/order/${res.order_no}`)
  } catch { ElMessage.error('下单失败，请重试') } finally { submitting.value = false }
}
</script>

<template>
  <div class="confirm-page">
    <div class="page-header"><h2>确认订单</h2></div>

    <div class="confirm-layout">
      <div class="confirm-main">
        <!-- Address -->
        <div class="confirm-section">
          <h3>收货地址</h3>
          <template v-if="selectedAddress">
            <div class="addr-list">
              <div
                v-for="addr in addresses"
                :key="addr.id"
                class="addr-card"
                :class="{ selected: selectedAddress.id === addr.id }"
                @click="selectAddress(addr)"
              >
                <div><strong>{{ addr.name }}</strong><span style="color:#999;margin-left:12px">{{ addr.phone }}</span></div>
                <div class="addr-detail">{{ addr.province }}{{ addr.city }}{{ addr.district }} {{ addr.detail }}</div>
                <el-tag v-if="addr.is_default" size="small" type="danger">默认</el-tag>
              </div>
            </div>
          </template>
          <div v-else-if="addrError" style="color:#f56c6c;font-size:13px">{{ addrError }} <el-button link type="primary" @click="loadAddresses">重试</el-button></div>
          <div v-else class="addr-empty" @click="$router.push('/user/address')"><el-icon><Plus /></el-icon> 请添加收货地址</div>
        </div>

        <!-- Items -->
        <div class="confirm-section">
          <h3>商品信息</h3>
          <table class="confirm-table">
            <tbody>
              <tr v-for="item in items" :key="item.goods_id">
                <td style="width:80px"><SafeImage :src="item.goods_image" :alt="item.goods_title" width="70" height="70" fit="cover" /></td>
                <td>{{ item.goods_title }}</td>
                <td style="width:100px"><span class="price">&yen;{{ formatPrice(item.price) }}</span></td>
                <td style="width:60px">x{{ item.quantity }}</td>
                <td style="width:100px"><span class="price">&yen;{{ formatPrice(item.price * item.quantity) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pay method -->
        <div class="confirm-section">
          <h3>支付方式</h3>
          <el-radio-group v-model="payMethod">
            <el-radio value="wechat" size="large">微信支付</el-radio>
            <el-radio value="alipay" size="large">支付宝</el-radio>
          </el-radio-group>
        </div>

        <!-- Remark -->
        <div class="confirm-section">
          <h3>订单备注</h3>
          <el-input v-model="remark" placeholder="选填" maxlength="200" show-word-limit />
        </div>
      </div>

      <div class="confirm-sidebar">
        <div class="summary-card">
          <h3>订单摘要</h3>
          <div class="summary-row"><span>商品合计 ({{ items.length }} 件)</span><span>&yen;{{ formatPrice(totalPrice) }}</span></div>
          <div class="summary-row"><span>运费</span><span>{{ freight === 0 ? '免运费' : '&yen;' + formatPrice(freight) }}</span></div>
          <div class="summary-row" v-if="discount > 0"><span>优惠</span><span style="color:#67c23a">-&yen;{{ formatPrice(discount) }}</span></div>
          <div class="summary-row summary-total"><span>应付金额</span><span class="price price-lg">&yen;{{ formatPrice(payAmount) }}</span></div>
          <el-button type="danger" size="large" :loading="submitting" @click="handleSubmit" :disabled="!selectedAddress" style="width:100%;margin-top:12px">
            提交订单
          </el-button>
          <p style="font-size:12px;color:#999;margin-top:8px;text-align:center">满 ¥99.00 免运费</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-page { max-width: 1200px; margin: 0 auto; }
.confirm-layout { display: flex; gap: 20px; }
.confirm-main { flex: 1; }
.confirm-section { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 16px; }
.confirm-section h3 { font-size: 15px; margin: 0 0 12px; }
.addr-list { display: flex; flex-direction: column; gap: 8px; }
.addr-card { padding: 12px; border: 1px solid #e8e8e8; border-radius: 6px; cursor: pointer; transition: all .2s; position: relative; }
.addr-card:hover { border-color: #ff6b35; }
.addr-card.selected { border-color: #ff6b35; background: #fff7f0; }
.addr-card.selected::after { content: '✓'; position: absolute; right: 12px; top: 12px; color: #ff6b35; font-weight: 700; font-size: 16px; }
.addr-detail { color: #666; margin-top: 4px; font-size: 13px; }
.addr-empty { display: flex; align-items: center; gap: 6px; color: #f56c6c; font-size: 14px; cursor: pointer; }
.confirm-table { width: 100%; border-collapse: collapse; }
.confirm-table td { padding: 10px 0; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
.confirm-sidebar { width: 300px; flex-shrink: 0; }
.summary-card { background: #fff; padding: 20px; border-radius: 8px; position: sticky; top: 20px; }
.summary-card h3 { font-size: 15px; margin: 0 0 14px; }
.summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
.summary-total { border-top: 1px solid #f5f5f5; margin-top: 4px; padding-top: 12px; font-weight: 600; }
</style>
