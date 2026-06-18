<script setup lang="ts">
const props = defineProps<{
  documentId: string
  currentExpiration: string
  isOpen: boolean
}>()

const emit = defineEmits(['close', 'updated'])
const { t } = useI18n()

const form = ref({
  expirationDate: ''
})

const error = ref<string | null>(null)
const isSubmitting = ref(false)

// Convert date ISO to YYYY-MM-DD format for date input
function getFormattedDate(dateString: string): string {
  if (!dateString) return ''
  return dateString.slice(0, 10)
}

// Initialize form with date
onMounted(() => {
  form.value.expirationDate = props.currentExpiration.slice(0, 10)
})

// Update form if prop changes
watch(() => props.currentExpiration, (newVal) => {
  form.value.expirationDate = newVal.slice(0, 10)
})

async function updateExpiration() {
  if (!form.value.expirationDate) {
    error.value = t('admin.documents.modal.dateRequired')
    return
  }

  isSubmitting.value = true
  error.value = null

  try {
    const response = await $fetch(
      `/api/documents/${props.documentId}/expiration`,
      {
        method: 'PATCH',
        body: { expirationDate: new Date(form.value.expirationDate).toISOString() }
      }
    )

    emit('updated', response)
    emit('close')
  } catch (err: any) {
    error.value = err.data?.message || err.message || t('admin.documents.modal.updateFailed')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <!-- Overlay -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    @click.self="emit('close')"
  >
    <!-- Modal -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div class="mb-4">
        <h2 class="text-xl font-bold">{{ t('admin.documents.modal.title') }}</h2>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('admin.documents.modal.description') }}
        </p>
      </div>

      <div class="space-y-4 py-4">
        <div>
          <label class="block text-sm font-medium mb-2">
            {{ t('admin.documents.modal.newExpirationLabel') }}
          </label>
          <input
            v-model="form.expirationDate"
            type="date"
            class="w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            :min="getFormattedDate(new Date().toISOString())"
          />
        </div>

        <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      </div>

      <div class="flex justify-end gap-3 mt-4">
        <button
          @click="emit('close')"
          class="px-4 py-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          :disabled="isSubmitting"
          @click="updateExpiration"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <span v-if="!isSubmitting">{{ t('common.save') }}</span>
          <span v-else>{{ t('admin.documents.loading') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
