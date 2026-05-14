<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  fit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'
  radius?: number
}>(), {
  alt: '',
  fit: 'cover',
})

const imgError = ref(false)
const imgLoading = ref(true)

watch(() => props.src, (v) => {
  imgError.value = false
  imgLoading.value = true
})

function onError() {
  imgError.value = true
  imgLoading.value = false
}
function onLoad() {
  imgLoading.value = false
}

function parseDim(v: number | string | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseInt(v)
    if (!isNaN(n)) return n
  }
  return 200
}

const fallbackSvg = computed(() => {
  const w = parseDim(props.width)
  const h = parseDim(props.height)
  const label = props.alt || '暂无图片'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f5f7fa"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" font-size="14" fill="#c0c4cc" font-family="sans-serif">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})

const showOriginal = computed(() => props.src && !imgError)
const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? props.width + 'px' : props.width || '100%',
  height: typeof props.height === 'number' ? props.height + 'px' : props.height || '200px',
  borderRadius: (props.radius || 0) + 'px',
}))
const imgStyle = computed(() => ({
  objectFit: props.fit,
  borderRadius: (props.radius || 0) + 'px',
}))
</script>

<template>
  <div class="safe-image" :style="containerStyle">
    <img
      v-if="showOriginal"
      :src="src"
      :alt="alt"
      :style="imgStyle"
      @error="onError"
      @load="onLoad"
    />
    <img
      v-else
      :src="fallbackSvg"
      :alt="alt || 'placeholder'"
      :style="imgStyle"
    />
  </div>
</template>

<style scoped>
.safe-image {
  overflow: hidden;
  position: relative;
  background: #f5f7fa;
  flex-shrink: 0;
}
.safe-image img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
