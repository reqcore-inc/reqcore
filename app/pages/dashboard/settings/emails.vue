<script setup lang="ts">
import { Mail, Save, Loader2, AlertTriangle, RotateCcw } from 'lucide-vue-next'
import {
  renderTemplate,
  extractTemplateTags,
  TEMPLATE_TAG_PATTERN,
  TEMPLATE_TAG_LIKE_PATTERN,
} from '~~/shared/template-renderer'

definePageMeta({})

useSeoMeta({
  title: 'Email Templates — Reqcore',
  description: 'Customize the screening invitation email sent to candidates',
})

const toast = useToast()
const { data: session } = await authClient.useSession(useFetch)
const { activeOrg } = useCurrentOrg()

interface ScreeningEmailTemplateResponse {
  subject: string
  body: string
  isDefault: boolean
  variables: readonly string[]
}

const { data, refresh } = await useFetch<ScreeningEmailTemplateResponse>('/api/screening-email-template', {
  key: 'screening-email-template',
  headers: useRequestHeaders(['cookie']),
})

// ─────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────
const subject = ref('')
const body = ref('')
const isDefault = ref(true)
const hasEdited = ref(false)
const variables = computed(() => data.value?.variables ?? [])

watch(data, (value) => {
  if (!value) return
  subject.value = value.subject
  body.value = value.body
  isDefault.value = value.isDefault
  hasEdited.value = false
}, { immediate: true })

function markEdited() {
  hasEdited.value = true
}

const usingDefault = computed(() => isDefault.value && !hasEdited.value)

// ─────────────────────────────────────────────
// Variable chips — insert {{var}} at the cursor of whichever field
// (subject or body) the user last focused.
// ─────────────────────────────────────────────
type ActiveField = 'subject' | 'body'
const activeField = ref<ActiveField>('body')
const subjectInputRef = ref<HTMLInputElement | null>(null)
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)

function setActiveField(field: ActiveField) {
  activeField.value = field
}

function insertVariable(name: string) {
  const placeholder = `{{${name}}}`
  const targetRef = activeField.value === 'subject' ? subjectInputRef : bodyTextareaRef
  const valueRef = activeField.value === 'subject' ? subject : body
  const el = targetRef.value

  markEdited()

  if (!el) {
    valueRef.value += placeholder
    return
  }

  const start = el.selectionStart ?? valueRef.value.length
  const end = el.selectionEnd ?? valueRef.value.length
  valueRef.value = valueRef.value.slice(0, start) + placeholder + valueRef.value.slice(end)

  nextTick(() => {
    const cursor = start + placeholder.length
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}

// ─────────────────────────────────────────────
// Unknown/malformed tag warnings — reuses the shared renderer's own tag
// patterns so this can never drift from what renderTemplate() actually
// substitutes. No new {{...}} regex is introduced here.
// ─────────────────────────────────────────────
function findTagWarnings(text: string): string[] {
  const allowed = new Set<string>(variables.value)
  const warnings = new Set<string>()

  for (const tag of extractTemplateTags(text)) {
    if (!allowed.has(tag)) {
      warnings.add(`{{${tag}}}`)
    }
  }

  const wellFormedRaw = new Set([...text.matchAll(TEMPLATE_TAG_PATTERN)].map(match => match[0]))
  for (const match of text.matchAll(TEMPLATE_TAG_LIKE_PATTERN)) {
    if (!wellFormedRaw.has(match[0])) {
      warnings.add(match[0])
    }
  }

  return [...warnings]
}

const subjectWarnings = computed(() => findTagWarnings(subject.value))
const bodyWarnings = computed(() => findTagWarnings(body.value))
const hasWarnings = computed(() => subjectWarnings.value.length > 0 || bodyWarnings.value.length > 0)

// ─────────────────────────────────────────────
// Live preview — sample data rendered through the shared renderer.
// Plain-text interpolation only (no v-html), so there is no XSS surface here.
// ─────────────────────────────────────────────
const sampleVariables = computed<Record<string, string>>(() => ({
  candidateName: 'Jane Doe',
  candidateFirstName: 'Jane',
  candidateLastName: 'Doe',
  candidateEmail: 'jane.doe@example.com',
  jobTitle: 'Senior Engineer',
  organizationName: activeOrg.value?.name ?? 'Acme Corp',
  senderName: session.value?.user?.name ?? 'Your Name',
}))

const previewSubject = computed(() => renderTemplate(subject.value, sampleVariables.value))
const previewBody = computed(() => renderTemplate(body.value, sampleVariables.value))

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
const isSaving = ref(false)
const saveError = ref('')

async function handleSave() {
  saveError.value = ''
  isSaving.value = true

  try {
    await $fetch('/api/screening-email-template', {
      method: 'PUT',
      body: {
        subject: subject.value,
        body: body.value,
      },
    })
    await refresh()
    toast.success('Template saved', 'Your screening invitation email has been updated.')
  }
  catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save template'
    toast.error('Could not save template', { message: saveError.value })
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <!-- Page title -->
    <div class="mb-6">
      <h1 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
        Emails
      </h1>
      <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
        Customize the screening invitation email sent to candidates.
      </p>
    </div>

    <!-- Using default template banner -->
    <div
      v-if="usingDefault"
      class="mb-6 flex items-center gap-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50 px-4 py-3 text-sm text-surface-600 dark:text-surface-300"
    >
      <RotateCcw class="size-4 shrink-0 text-surface-400" />
      Using the default template. Edit the subject or body below to customize it.
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <!-- Editor -->
      <section class="space-y-5">
        <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden">
          <div class="px-4 sm:px-6 py-5 border-b border-surface-200 dark:border-surface-800">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center size-10 shrink-0 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                <Mail class="size-5" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-surface-900 dark:text-surface-100">Screening invitation</h2>
                <p class="text-sm text-surface-500 dark:text-surface-400">Sent when you invite a candidate to complete a screening.</p>
              </div>
            </div>
          </div>

          <div class="px-4 sm:px-6 py-5 space-y-5">
            <!-- Subject -->
            <div>
              <label for="template-subject" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Subject
              </label>
              <input
                id="template-subject"
                ref="subjectInputRef"
                v-model="subject"
                type="text"
                class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm font-mono text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                placeholder="e.g. Next steps: {{jobTitle}} at {{organizationName}}"
                @input="markEdited"
                @focus="setActiveField('subject')"
              />
              <p v-if="subjectWarnings.length" class="mt-1.5 flex items-start gap-1.5 text-xs text-warning-600 dark:text-warning-400">
                <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
                Unknown or malformed variable(s): {{ subjectWarnings.join(', ') }}
              </p>
            </div>

            <!-- Body -->
            <div>
              <label for="template-body" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Body
              </label>
              <textarea
                id="template-body"
                ref="bodyTextareaRef"
                v-model="body"
                rows="14"
                class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm font-mono text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-none leading-relaxed"
                placeholder="Write the invitation email here. Use {{variables}} for dynamic content…"
                @input="markEdited"
                @focus="setActiveField('body')"
              />
              <p v-if="bodyWarnings.length" class="mt-1.5 flex items-start gap-1.5 text-xs text-warning-600 dark:text-warning-400">
                <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
                Unknown or malformed variable(s): {{ bodyWarnings.join(', ') }}
              </p>
            </div>

            <!-- Save -->
            <div class="flex items-center gap-3 pt-2">
              <button
                :disabled="isSaving"
                class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleSave"
              >
                <Loader2 v-if="isSaving" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
                {{ isSaving ? 'Saving…' : 'Save template' }}
              </button>
            </div>

            <div v-if="saveError" class="rounded-lg bg-danger-50 dark:bg-danger-950/40 border border-danger-200 dark:border-danger-900 px-4 py-3 text-sm text-danger-700 dark:text-danger-400">
              {{ saveError }}
            </div>
          </div>
        </div>
      </section>

      <!-- Sidebar: variables + preview -->
      <section class="space-y-5">
        <!-- Variable chips -->
        <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
            Variables
          </h3>
          <p class="text-xs text-surface-400 dark:text-surface-500 mb-3">
            Click to insert into the {{ activeField === 'subject' ? 'subject' : 'body' }} at the cursor.
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="name in variables"
              :key="name"
              type="button"
              class="inline-flex items-center rounded-full bg-surface-50 dark:bg-surface-800/60 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 px-2.5 py-1 text-xs font-mono text-brand-700 dark:text-brand-300 transition-colors cursor-pointer"
              @click="insertVariable(name)"
            >
              {{ `{{${name}}}` }}
            </button>
          </div>
        </div>

        <!-- Live preview -->
        <div class="rounded-xl border border-brand-200 dark:border-brand-800/60 bg-white dark:bg-surface-900 overflow-hidden">
          <div class="border-b border-brand-100 dark:border-brand-900/40 bg-brand-50/50 dark:bg-brand-950/20 px-5 py-3">
            <div class="flex items-center gap-2">
              <Mail class="size-4 text-brand-500 dark:text-brand-400" />
              <span class="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Live Preview</span>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <span class="text-[10px] uppercase tracking-wider font-semibold text-surface-400 block mb-1">Subject</span>
              <p class="text-sm font-semibold text-surface-800 dark:text-surface-200">
                {{ previewSubject || 'Enter a subject line…' }}
              </p>
            </div>
            <div class="border-t border-surface-100 dark:border-surface-800 pt-4">
              <span class="text-[10px] uppercase tracking-wider font-semibold text-surface-400 block mb-2">Body</span>
              <div class="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
                {{ previewBody || 'Start writing to see a preview…' }}
              </div>
            </div>
          </div>
          <div class="border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/30 px-5 py-2.5">
            <p class="text-[11px] text-surface-400 dark:text-surface-500 italic">
              Preview uses sample data. Actual values are populated when the email is sent.
            </p>
          </div>
        </div>

        <p v-if="hasWarnings" class="text-[11px] text-warning-600 dark:text-warning-400">
          Unresolved variables will appear as literal text in the sent email.
        </p>
      </section>
    </div>
  </div>
</template>
