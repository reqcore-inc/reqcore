<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: ['auth'],
})

useSeoMeta({
  title: 'Create Organization — Applirank',
  description: 'Create your organization to start recruiting',
})

const orgName = ref('')
const slug = ref('')
const slugEdited = ref(false)
const error = ref('')
const isLoading = ref(false)

/** Auto-generate slug from org name unless user has manually edited it */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

watch(orgName, (newName) => {
  if (!slugEdited.value) {
    slug.value = generateSlug(newName)
  }
})

function onSlugInput() {
  slugEdited.value = true
}

async function handleCreateOrg() {
  error.value = ''

  if (!orgName.value.trim()) {
    error.value = 'Organization name is required.'
    return
  }

  if (!slug.value.trim()) {
    error.value = 'Slug is required.'
    return
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug.value)) {
    error.value = 'Slug must be lowercase alphanumeric with hyphens, and cannot start or end with a hyphen.'
    return
  }

  isLoading.value = true

  try {
    const { createOrg } = useCurrentOrg()
    await createOrg({ name: orgName.value.trim(), slug: slug.value.trim() })
  }
  catch (err: any) {
    error.value = err?.message ?? 'Failed to create organization. The slug may already be taken.'
    isLoading.value = false
  }
}
</script>

<template>
  <form class="auth-form" @submit.prevent="handleCreateOrg">
    <h2 class="form-title">Create your organization</h2>
    <p class="form-subtitle">
      Set up your workspace to start managing candidates and jobs.
    </p>

    <div v-if="error" class="form-error">{{ error }}</div>

    <label class="form-label">
      <span>Organization name</span>
      <input
        v-model="orgName"
        type="text"
        placeholder="Acme Corp"
        required
        class="form-input"
      />
    </label>

    <label class="form-label">
      <span>Slug</span>
      <input
        v-model="slug"
        type="text"
        placeholder="acme-corp"
        required
        class="form-input"
        @input="onSlugInput"
      />
      <span class="form-hint">Used in URLs. Lowercase letters, numbers, and hyphens only.</span>
    </label>

    <button type="submit" :disabled="isLoading" class="form-button">
      {{ isLoading ? 'Creating…' : 'Create organization' }}
    </button>
  </form>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.form-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin: 0 0 0.5rem;
  text-align: center;
}

.form-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.875rem;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.form-hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: #9ca3af;
}

.form-button {
  padding: 0.625rem 1rem;
  background: #111;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}

.form-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-button:hover:not(:disabled) {
  background: #333;
}
</style>
