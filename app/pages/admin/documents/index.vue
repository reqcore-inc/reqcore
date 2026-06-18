<script setup lang="ts">
// Components
import DocumentExpirationModal from '~/components/admin/DocumentExpirationModal.vue'
import {
  Edit3, RefreshCw,
} from 'lucide-vue-next'
// Composables
const { formatDateTime } = useOrgSettings()
const { t } = useI18n()
const { allowed: canUpdateExpirationDate } = usePermission({ document: ['update'] })

// Types
interface Document {
  id: string
  storageKey: string
  originalFilename: string
  organizationId: string
  candidateId: string
  createdAt: string
  expirationDate: string
}

const documents = ref<Document[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const selectedDocument = ref<Document | null>(null)

// Load all documents from API
async function loadDocuments() {
  isLoading.value = true
  error.value = null
  
  try {
    const response = await $fetch('/api/documents')
    documents.value = response
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to load documents'
  } finally {
    isLoading.value = false
  }
}

// Open modal to edit document expiration date
function openExpirationModal(doc: Document) {
  selectedDocument.value = doc
}

// Refresh documents list after update
function handleUpdated() {
  loadDocuments()
}


// Load documents on component mount
onMounted(() => {
  loadDocuments()
})
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.documents.title') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('admin.documents.description') }}
        </p>
      </div>
      <button
        @click="loadDocuments"
        :disabled="isLoading"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw class="size-3.5" />
        {{ t('admin.documents.refresh') }}
      </button>
    </div>

    <!-- Error message -->
    <div v-if="error" class="p-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-md mb-4">
      {{ error }}
    </div>

    <!-- Documents table -->
    <div class="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th class="text-left p-4 font-semibold text-gray-900 dark:text-white">{{ t('admin.documents.table.file') }}</th>
            <th class="text-left p-4 font-semibold text-gray-900 dark:text-white">{{ t('admin.documents.table.createdAt') }}</th>
            <th class="text-left p-4 font-semibold text-gray-900 dark:text-white">{{ t('admin.documents.table.expiresAt') }}</th>
            <th class="text-left p-4 font-semibold text-gray-900 dark:text-white w-24">{{ t('admin.documents.table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="4" class="p-8 text-center text-gray-500 dark:text-gray-400">
              {{ t('admin.documents.loading') }}
            </td>
          </tr>
          <tr v-else-if="documents.length === 0">
            <td colspan="4" class="p-8 text-center text-gray-500 dark:text-gray-400">
              {{ t('admin.documents.empty') }}
            </td>
          </tr>
          <tr
            v-for="doc in documents"
            :key="doc.id"
            class="border-t hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <td class="p-4 max-w-[300px] truncate text-gray-900 dark:text-white">{{ doc.originalFilename }}</td>
            <td class="p-4 text-gray-600 dark:text-gray-300">{{ formatDateTime(doc.createdAt) }}</td>
            <td class="p-4">
              <span
                :class="{
                  'text-red-500 dark:text-red-400': new Date(doc.expirationDate) < new Date(),
                  'text-amber-500 dark:text-amber-400': 
                    new Date(doc.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                    new Date(doc.expirationDate) >= new Date(),
                  'text-gray-600 dark:text-gray-300': new Date(doc.expirationDate) >= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }"
              >
                {{ formatDateTime(doc.expirationDate) }}
              </span>
            </td>
            <td class="p-4">
              <button
                @click="canUpdateExpirationDate && openExpirationModal(doc)"
                :disabled="!canUpdateExpirationDate"
                class="inline-flex items-center gap-1.5 px-3 py-1 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('admin.documents.editExpiration')"
              >
                <Edit3 class="size-3.5" />
                {{ t('admin.documents.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="mt-4 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-4">
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-red-500"></span>
        <span>{{ t('admin.documents.legend.expired') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-amber-500"></span>
        <span>{{ t('admin.documents.legend.expiresSoon') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-gray-400"></span>
        <span>{{ t('admin.documents.legend.ok') }}</span>
      </div>
    </div>

    <!-- Edit expiration modal -->
    <DocumentExpirationModal
      v-if="selectedDocument"
      :document-id="selectedDocument.id"
      :current-expiration="selectedDocument.expirationDate"
      :is-open="!!selectedDocument"
      @close="selectedDocument = null"
      @updated="handleUpdated"
    />
  </div>
</template>
