<script setup lang="ts">
import { ref } from 'vue'
import { submitFeedback } from '@/api/common'
import { ElMessage } from 'element-plus'

const content = ref('')
const contact = ref('')
const type = ref('suggest')
const submitting = ref(false)

async function handleSubmit() {
  if (!content.value.trim()) { ElMessage.warning('请输入反馈内容'); return }
  if (content.value.trim().length < 5) { ElMessage.warning('反馈内容至少5个字'); return }
  submitting.value = true
  try {
    await submitFeedback({ type: type.value, content: content.value.trim(), contact: contact.value.trim() || undefined })
    ElMessage.success('感谢您的反馈！')
    content.value = ''; contact.value = ''
  } catch { ElMessage.error('提交失败，请稍后重试') } finally { submitting.value = false }
}
</script>

<template>
  <div class="feedback-page">
    <div class="page-header"><h2>意见反馈</h2></div>

    <div class="fb-card">
      <el-form label-position="top">
        <el-form-item label="反馈类型">
          <el-radio-group v-model="type">
            <el-radio value="bug">问题反馈</el-radio>
            <el-radio value="suggest">功能建议</el-radio>
            <el-radio value="complaint">投诉</el-radio>
            <el-radio value="other">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="反馈内容">
          <el-input v-model="content" type="textarea" :rows="6" placeholder="请详细描述您的问题或建议（至少5个字）" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="联系方式（选填）">
          <el-input v-model="contact" placeholder="手机号/邮箱，方便我们联系您" style="max-width:400px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit" :disabled="content.trim().length < 5">提交反馈</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.feedback-page { max-width: 700px; margin: 0 auto; }
.fb-card { background: #fff; padding: 30px; border-radius: 8px; }
</style>
