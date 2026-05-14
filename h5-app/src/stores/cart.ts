import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getCartCount } from '@/api/cart'

export const useCartStore = defineStore('cart', () => {
  const count = ref(0)

  const hasItems = computed(() => count.value > 0)

  function setCount(n: number) {
    count.value = n
  }

  function addCount(n: number) {
    count.value += n
  }

  function clearCount() {
    count.value = 0
  }

  async function fetchCount() {
    try {
      const res = await getCartCount()
      if (typeof res.count === 'number') count.value = res.count
    } catch { /* non-critical, keep existing count */ }
  }

  return { count, hasItems, setCount, addCount, clearCount, fetchCount }
})
