<script setup lang="ts">
import { X, Mail, Send, Eye, ChevronDown, Check, AlertCircle } from 'lucide-vue-next'
import { renderTemplate } from '~~/shared/template-renderer'

interface ScreeningInviteApplication {
  id: string
  screeningInvitationSentAt: string | Date | null
  candidate: {
    firstName: string
    lastName: string
    email: string
  }
  job: {
    title: string
  }
}

const props = defineProps<{
  application: ScreeningInviteApplication
}>()

const emit = defineEmits<{
  close: []
  sent: [payload: { sentAt: string, statusAdvanced: boolean }]
}>()

const { formatPersonName } = useOrgSettings()
const { activeOrg } = useCurrentOrg()
const { data: session } = await authClient.useSession(useFetch)

// ─── Sender's screening template (server is the source of truth — this ────
// preview is a best-effort approximation rendered client-side with the same
// shared renderer the server uses) ──────────────────────────────────────────
interface ScreeningEmailTemplateResponse {
  subject: string
  body: string
  isDefault: boolean
  variables: readonly string[]
}

const { data: template, status: templateStatus } = useFetch<ScreeningEmailTemplateResponse>('/api/screening-email-template', {
  key: 'screening-email-template',
  headers: useRequestHeaders(['cookie']),
})

const isResend = computed(() => !!props.application.screeningInvitationSentAt)

// NOTE: candidateName intentionally mirrors the server's exact construction
// (`${firstName} ${lastName}`, see send-screening-invitation.post.ts) rather
// than formatPersonName()'s org-aware nameDisplayFormat. Using the org
// preference here would make this preview diverge from the email actually
// sent for orgs configured with a "last_first" display order.
const previewVariables = computed<Record<string, string>>(() => ({
  candidateName: `${props.application.candidate.firstName} ${props.application.candidate.lastName}`,
  candidateFirstName: props.application.candidate.firstName,
  candidateLastName: props.application.candidate.lastName,
  candidateEmail: props.application.candidate.email,
  jobTitle: props.application.job.title,
  organizationName: activeOrg.value?.name ?? 'Your Organization',
  senderName: session.value?.user?.name ?? 'Your Name',
}))

const previewSubject = computed(() =>
  template.value ? renderTemplate(template.value.subject, previewVariables.value) : '',
)
const previewBody = computed(() =>
  template.value ? renderTemplate(template.value.body, previewVariables.value) : '',
)

const showPreview = ref(false)
const isSending = ref(false)
const sendError = ref('')
const sendSuccess = ref(false)

async function handleSend() {
  sendError.value = ''
  isSending.value = true

  try {
    const result = await $fetch<{ sent: boolean, sentAt: string, statusAdvanced: boolean }>(
      `/api/applications/${props.application.id}/send-screening-invitation`,
      { method: 'POST' },
    )
    sendSuccess.value = true
    setTimeout(() => {
      emit('sent', { sentAt: result.sentAt, statusAdvanced: result.statusAdvanced })
    }, 1200)
  } catch (err: any) {
    if (err?.data?.statusCode === 429 || err?.statusCode === 429) {
      sendError.value = 'This candidate was already invited recently. Please wait about 2 minutes before resending.'
    } else {
      sendError.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to send screening invitation email'
    }
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="emit('close')" />

      <!-- Modal -->
      <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl shadow-surface-900/10 dark:shadow-black/30 ring-1 ring-surface-200/80 dark:ring-surface-700/60 w-full max-w-xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="shrink-0 border-b border-surface-200/80 dark:border-surface-800/60 px-4 sm:px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="flex size-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/40">
                <Mail class="size-4.5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-surface-900 dark:text-surface-100">
                  {{ isResend ? 'Resend Screening Invitation' : 'Invite to Screening' }}
                </h2>
                <p class="text-xs text-surface-500 dark:text-surface-400">
                  to {{ formatPersonName(application.candidate.firstName, application.candidate.lastName) }} · {{ application.candidate.email }}
                </p>
              </div>
            </div>
            <button
              class="rounded-lg p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-all cursor-pointer"
              @click="emit('close')"
            >
              <X class="size-5" />
            </button>
          </div>
        </div>

        <!-- Success state -->
        <div v-if="sendSuccess" class="flex-1 flex flex-col items-center justify-center py-12 px-6">
          <div class="flex size-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-950/40 mb-4">
            <Check class="size-7 text-success-600 dark:text-success-400" />
          </div>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1.5">Invitation Sent!</h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 text-center">
            The screening invitation has been sent to {{ application.candidate.email }}.
          </p>
        </div>

        <!-- Main content -->
        <template v-else>
          <!-- Error -->
          <div v-if="sendError" class="mx-4 sm:mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-danger-200/80 bg-danger-50 p-3.5 text-sm text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
            <AlertCircle class="size-4 shrink-0 mt-0.5" />
            {{ sendError }}
          </div>

          <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            <p class="text-sm text-surface-600 dark:text-surface-300">
              This will send your screening invitation email template to
              <span class="font-semibold text-surface-800 dark:text-surface-100">{{ application.candidate.email }}</span>.
              Applications still in <span class="font-medium">New</span> status will automatically move to <span class="font-medium">Screening</span>.
            </p>

            <!-- Preview toggle -->
            <div>
              <button
                type="button"
                class="flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer"
                @click="showPreview = !showPreview"
              >
                <Eye class="size-3.5" />
                {{ showPreview ? 'Hide Preview' : 'Show Preview' }}
                <ChevronDown
                  class="size-3.5 transition-transform"
                  :class="showPreview ? 'rotate-180' : ''"
                />
              </button>
              <div v-if="showPreview" class="mt-3 rounded-xl border border-surface-200 dark:border-surface-700/80 bg-surface-50 dark:bg-surface-800/40 p-4">
                <div v-if="templateStatus === 'pending'" class="text-sm text-surface-400 dark:text-surface-500">
                  Loading preview…
                </div>
                <template v-else>
                  <div class="mb-2">
                    <span class="text-[10px] uppercase tracking-wider font-semibold text-surface-400">Subject</span>
                    <p class="text-sm font-semibold text-surface-800 dark:text-surface-200">{{ previewSubject }}</p>
                  </div>
                  <div>
                    <span class="text-[10px] uppercase tracking-wider font-semibold text-surface-400">Body</span>
                    <p class="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap mt-1">{{ previewBody }}</p>
                  </div>
                </template>
                <p class="mt-3 text-[11px] text-surface-400 dark:text-surface-500 italic">
                  This preview is an approximation. The actual email sent uses your saved template on the server.
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 border-t border-surface-200/80 dark:border-surface-800/60 bg-surface-50/80 dark:bg-surface-950/60 px-6 py-4">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
                @click="emit('close')"
              >
                Cancel
              </button>
              <button
                type="button"
                :disabled="isSending"
                class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shadow-brand-500/20"
                @click="handleSend"
              >
                <Send class="size-4" />
                {{ isSending ? 'Sending…' : (isResend ? 'Resend Invitation' : 'Send Invitation') }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
