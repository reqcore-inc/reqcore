<script setup lang="ts">
import { ArrowLeft, ChevronRight, Github, LayoutList } from 'lucide-vue-next'

interface FeatureDoc {
  path: string
  title: string
  description?: string
  status: 'shipped' | 'building' | 'vision'
  type: 'pillar' | 'feature' | 'idea'
  order: number
  body?: unknown
}

const route = useRoute()

const contentPath = computed(() => {
  const slug = route.params.slug
  const segments = Array.isArray(slug) ? slug : [slug]
  return `/features/${segments.join('/')}`
})

const lookupPaths = computed(() => [contentPath.value, `${contentPath.value}/index`])

const { data: feature } = await useAsyncData(
  () => `feature-${contentPath.value}`,
  async () => {
    for (const path of lookupPaths.value) {
      const doc = await queryCollection('features').path(path).first()
      if (doc) return doc as FeatureDoc
    }
    return null
  },
)

if (!feature.value) {
  throw createError({ statusCode: 404, statusMessage: 'Feature page not found' })
}

const { data: allFeatures } = await useAsyncData('all-feature-pages', () =>
  queryCollection('features').all(),
)

const children = computed(() => {
  const docs = (allFeatures.value ?? []) as FeatureDoc[]
  const prefix = `${feature.value!.path}/`

  return docs
    .filter(doc => doc.path.startsWith(prefix))
    .filter((doc) => {
      const relative = doc.path.slice(prefix.length)
      return relative.length > 0 && !relative.includes('/')
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
})

const breadcrumbItems = computed(() => {
  const segments = contentPath.value.replace('/features/', '').split('/').filter(Boolean)

  return segments.map((segment, index) => {
    const slug = segments.slice(0, index + 1).join('/')
    return {
      label: segment.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      to: `/features/${slug}`,
    }
  })
})

const statusClasses: Record<FeatureDoc['status'], string> = {
  shipped: 'border-success-400/25 bg-success-400/10 text-success-300',
  building: 'border-brand-400/25 bg-brand-400/10 text-brand-300',
  vision: 'border-purple-400/25 bg-purple-400/10 text-purple-300',
}

const statusLabel: Record<FeatureDoc['status'], string> = {
  shipped: 'Shipped',
  building: 'Building',
  vision: 'Vision',
}

useSeoMeta({
  title: `${feature.value.title} — Feature`,
  description: feature.value.description || 'Product feature and roadmap details in a Markdown hierarchy.',
  ogTitle: `${feature.value.title} — Applirank Features`,
  ogDescription: feature.value.description || 'Product feature and roadmap details in a Markdown hierarchy.',
  ogType: 'article',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image',
  twitterTitle: `${feature.value.title} — Applirank Features`,
  twitterDescription: feature.value.description || 'Product feature and roadmap details in a Markdown hierarchy.',
})

useHead({
  bodyAttrs: {
    style: 'background-color: #09090b;',
  },
})

const { data: session } = await authClient.useSession(useFetch)
</script>

<template>
  <div class="min-h-screen bg-[#09090b] text-white antialiased">
    <nav class="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <NuxtLink to="/" class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
          <span class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-xs font-black text-white">A</span>
          Applirank
        </NuxtLink>

        <div class="flex items-center gap-2">
          <NuxtLink to="/roadmap" class="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white sm:inline-flex">
            Roadmap
          </NuxtLink>
          <NuxtLink to="/features" class="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition sm:inline-flex">
            Features
          </NuxtLink>
          <NuxtLink to="/blog" class="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white sm:inline-flex">
            Blog
          </NuxtLink>
          <a
            href="https://github.com/applirank/applirank"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white sm:flex"
          >
            <Github class="size-3.5" />
            GitHub
          </a>

          <ClientOnly>
            <template v-if="session">
              <NuxtLink to="/dashboard" class="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/15">
                Dashboard
              </NuxtLink>
            </template>
            <template v-else>
              <NuxtLink :to="{ path: '/auth/sign-in', query: { redirect: $route.path } }" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white">
                Sign In
              </NuxtLink>
              <NuxtLink to="/auth/sign-up" class="rounded-md bg-white text-[13px] font-semibold text-black px-3 py-1.5 transition hover:bg-white/90">
                Get Started
              </NuxtLink>
            </template>

            <template #fallback>
              <NuxtLink to="/auth/sign-in" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white">
                Sign In
              </NuxtLink>
              <NuxtLink to="/auth/sign-up" class="rounded-md bg-white text-[13px] font-semibold text-black px-3 py-1.5 transition hover:bg-white/90">
                Get Started
              </NuxtLink>
            </template>
          </ClientOnly>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-3xl px-6 pt-28 pb-20">
      <NuxtLink
        to="/features"
        class="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
      >
        <ArrowLeft class="size-3.5" />
        All features
      </NuxtLink>

      <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/40">
        <NuxtLink to="/features" class="transition hover:text-white">Features</NuxtLink>
        <template v-for="(item, index) in breadcrumbItems" :key="item.to">
          <ChevronRight class="size-3" />
          <NuxtLink
            :to="item.to"
            class="transition hover:text-white"
            :class="index === breadcrumbItems.length - 1 ? 'text-white/70' : 'text-white/40'"
          >
            {{ item.label }}
          </NuxtLink>
        </template>
      </div>

      <header class="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full border px-2.5 py-1 text-xs font-medium" :class="statusClasses[feature!.status]">
            {{ statusLabel[feature!.status] }}
          </span>
          <span class="rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-xs text-white/60">
            {{ feature!.type }}
          </span>
        </div>
        <h1 class="mt-4 text-3xl font-extrabold tracking-tight">{{ feature!.title }}</h1>
        <p v-if="feature!.description" class="mt-3 text-sm leading-relaxed text-white/60">
          {{ feature!.description }}
        </p>
      </header>

      <article
        class="prose prose-invert prose-lg max-w-none rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 prose-headings:tracking-tight prose-headings:font-bold prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-brand-300 prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.06]"
      >
        <ContentRenderer v-if="feature" :value="feature" />
      </article>

      <section v-if="children.length" class="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
        <h2 class="inline-flex items-center gap-2 text-base font-semibold text-white">
          <LayoutList class="size-4" />
          Sub-items
        </h2>

        <ul class="mt-4 space-y-2">
          <li v-for="child in children" :key="child.path">
            <NuxtLink
              :to="child.path"
              class="group inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
            >
              <ChevronRight class="size-3.5 text-white/40 transition group-hover:text-brand-300" />
              {{ child.title }}
            </NuxtLink>
          </li>
        </ul>
      </section>

      <div class="mt-8">
        <GiscusComments />
      </div>
    </main>
  </div>
</template>
