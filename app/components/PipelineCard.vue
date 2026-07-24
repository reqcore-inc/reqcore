<script setup lang="ts">
import { User, Calendar } from 'lucide-vue-next'
import { stageColorClasses, type PipelineStage } from '~~/shared/pipeline'

defineProps<{
  id: string
  candidateFirstName: string
  candidateLastName: string
  candidateEmail: string
  createdAt: string
  score: number | null
  /**
   * Stages this card can be moved to — the job's other custom stages. Moves are
   * free-form now, so this is simply "every stage except the current one".
   */
  allowedTransitions: PipelineStage[]
  isTransitioning: boolean
}>()

defineEmits<{
  (e: 'transition', stageId: string): void
}>()

const { formatPersonName, formatDateTime } = useOrgSettings()
</script>

<template>
  <div class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-3 shadow-sm shadow-surface-900/[0.03] dark:shadow-none">
    <NuxtLink
      :to="$localePath(`/dashboard/applications/${id}`)"
      class="block mb-2 group"
    >
      <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
        {{ formatPersonName(candidateFirstName, candidateLastName) }}
      </h4>
      <div class="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
        <a
          :href="`mailto:${candidateEmail}`"
          target="_blank"
          class="inline-flex items-center gap-1 truncate hover:text-brand-600 dark:hover:text-brand-400 hover:underline cursor-pointer transition-colors"
          @click.stop
        >
          <User class="size-3 shrink-0" />
          {{ candidateEmail }}
        </a>
      </div>
    </NuxtLink>

    <div class="flex items-center justify-between text-xs text-surface-400">
      <span class="inline-flex items-center gap-1">
        <Calendar class="size-3" />
        {{ formatDateTime(createdAt) }}
      </span>
      <span v-if="score != null" class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
        :class="score >= 75
          ? 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950 dark:text-success-300 dark:ring-success-800'
          : score >= 40
            ? 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950 dark:text-warning-300 dark:ring-warning-800'
            : 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950 dark:text-danger-300 dark:ring-danger-800'"
      >
        {{ score }}pts
      </span>
    </div>

    <!-- Transition buttons -->
    <div v-if="allowedTransitions.length > 0" class="flex flex-wrap gap-1 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800/60">
      <button
        v-for="nextStage in allowedTransitions"
        :key="nextStage.id"
        :disabled="isTransitioning"
        class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50"
        :class="stageColorClasses(nextStage.color).badge"
        @click.prevent="$emit('transition', nextStage.id)"
      >
        {{ nextStage.name }}
      </button>
    </div>
  </div>
</template>
