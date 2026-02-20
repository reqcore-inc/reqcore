<script setup lang="ts">
import Giscus from '@giscus/vue'
import type { BooleanString, InputPosition, Mapping, Repo } from '@giscus/vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()

const widgetKey = ref(0)

function cleanupGiscusCallbackQuery() {
  const currentUrl = new URL(window.location.href)
  if (!currentUrl.searchParams.has('giscus')) {
    return
  }

  currentUrl.searchParams.delete('giscus')
  const nextQuery = currentUrl.searchParams.toString()
  const nextUrl = `${currentUrl.pathname}${nextQuery ? `?${nextQuery}` : ''}${currentUrl.hash}`

  window.history.replaceState(window.history.state, '', nextUrl)
}

function toBooleanString(value: string | undefined, fallback: BooleanString): BooleanString {
  return value === '0' || value === '1' ? value : fallback
}

function toMapping(value: string | undefined): Mapping {
  const allowed: Mapping[] = ['url', 'title', 'og:title', 'specific', 'number', 'pathname']
  return allowed.includes(value as Mapping) ? (value as Mapping) : 'pathname'
}

function toInputPosition(value: string | undefined): InputPosition {
  return value === 'top' || value === 'bottom' ? value : 'top'
}

const giscusConfig = computed(() => ({
  repo: (runtimeConfig.public.giscusRepo as Repo),
  repoId: runtimeConfig.public.giscusRepoId,
  category: runtimeConfig.public.giscusCategory,
  categoryId: runtimeConfig.public.giscusCategoryId,
  mapping: toMapping(runtimeConfig.public.giscusMapping),
  strict: toBooleanString(runtimeConfig.public.giscusStrict, '1'),
  reactionsEnabled: toBooleanString(runtimeConfig.public.giscusReactionsEnabled, '1'),
  emitMetadata: toBooleanString(runtimeConfig.public.giscusEmitMetadata, '0'),
  inputPosition: toInputPosition(runtimeConfig.public.giscusInputPosition),
  theme: runtimeConfig.public.giscusTheme || 'dark',
  lang: runtimeConfig.public.giscusLang || 'en',
}))

const isConfigured = computed(() => (
  !!giscusConfig.value.repo
  && !!giscusConfig.value.repoId
  && !!giscusConfig.value.category
  && !!giscusConfig.value.categoryId
))

onMounted(() => {
  cleanupGiscusCallbackQuery()
  widgetKey.value += 1
})

watch(() => route.path, () => {
  widgetKey.value += 1
})
</script>

<template>
  <section class="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-base font-semibold text-white">Comments</h2>
      <span class="text-xs text-white/40">Powered by Giscus</span>
    </div>

    <div
      v-if="!isConfigured"
      class="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200/90"
    >
      Configure Giscus env vars to enable page comments.
    </div>

    <Giscus
      v-else
      :key="widgetKey"
      :repo="giscusConfig.repo"
      :repo-id="giscusConfig.repoId"
      :category="giscusConfig.category"
      :category-id="giscusConfig.categoryId"
      :mapping="giscusConfig.mapping"
      :strict="giscusConfig.strict"
      :reactions-enabled="giscusConfig.reactionsEnabled"
      :emit-metadata="giscusConfig.emitMetadata"
      :input-position="giscusConfig.inputPosition"
      :theme="giscusConfig.theme"
      :lang="giscusConfig.lang"
      loading="lazy"
    />
  </section>
</template>
