<script setup lang="ts">
import { ArrowRight, Github, Layers, Star, ChevronRight } from 'lucide-vue-next'

interface FeaturePage {
  path: string
  title: string
  description?: string
  status: 'shipped' | 'building' | 'vision'
  type: 'pillar' | 'feature' | 'idea'
  order: number
}

interface FeatureNode {
  slug: string
  path: string
  title: string
  description?: string
  status: 'shipped' | 'building' | 'vision'
  type: 'pillar' | 'feature' | 'idea'
  order: number
  children: FeaturePage[]
}

useSeoMeta({
  title: 'Feature System — Product Capabilities & Ideas',
  description:
    'Browse Applirank features as a hierarchical Markdown system: shipped capabilities, active work, and future ideas.',
  ogTitle: 'Applirank Features — Hierarchical Product Map',
  ogDescription:
    'A transparent, Markdown-driven hierarchy of shipped, in-progress, and future product capabilities.',
  ogType: 'website',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Applirank Feature System',
  twitterDescription:
    'Explore shipped features, current work, and future ideas in a public hierarchical map.',
})

useHead({
  bodyAttrs: {
    style: 'background-color: #09090b;',
  },
})

const { data: session } = await authClient.useSession(useFetch)

const { data: pages } = await useAsyncData('feature-pages', () =>
  queryCollection('features').all(),
)

const statusClasses: Record<FeaturePage['status'], string> = {
  shipped: 'border-success-400/25 bg-success-400/10 text-success-300',
  building: 'border-brand-400/25 bg-brand-400/10 text-brand-300',
  vision: 'border-purple-400/25 bg-purple-400/10 text-purple-300',
}

const statusLabel: Record<FeaturePage['status'], string> = {
  shipped: 'Shipped',
  building: 'Building',
  vision: 'Vision',
}

const tree = computed<FeatureNode[]>(() => {
  const docs = (pages.value ?? []) as FeaturePage[]
  const map = new Map<string, FeatureNode>()

  for (const doc of docs) {
    const slug = doc.path.replace('/features/', '').split('/')[0] || 'uncategorized'

    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        path: `/features/${slug}`,
        title: slug
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        status: 'vision',
        type: 'pillar',
        order: 0,
        children: [],
      })
    }

    const node = map.get(slug)!
    const segments = doc.path.replace('/features/', '').split('/')

    if (segments.length === 1) {
      node.title = doc.title
      node.description = doc.description
      node.status = doc.status
      node.type = doc.type
      node.order = doc.order
    } else {
      node.children.push(doc)
    }
  }

  return [...map.values()]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((node) => ({
      ...node,
      children: node.children
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
})
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

    <main class="mx-auto max-w-5xl px-6 pt-28 pb-20">
      <section class="mb-10">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/60">
          <Layers class="size-3.5 text-brand-300" />
          Markdown hierarchy in public view
        </div>
        <h1 class="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Feature System</h1>
        <p class="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">
          These pages are generated from the <span class="font-medium text-white">content/features</span> folder, so you can manage the product hierarchy directly in VS Code.
        </p>
      </section>

      <section v-if="tree.length" class="space-y-6">
        <article
          v-for="node in tree"
          :key="node.slug"
          class="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <NuxtLink
              :to="node.path"
              class="group inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white transition hover:text-brand-300"
            >
              {{ node.title }}
              <ArrowRight class="size-4 transition group-hover:translate-x-0.5" />
            </NuxtLink>
            <span class="rounded-full border px-2.5 py-1 text-xs font-medium" :class="statusClasses[node.status]">
              {{ statusLabel[node.status] }}
            </span>
          </div>

          <p v-if="node.description" class="mt-3 text-sm text-white/60">
            {{ node.description }}
          </p>

          <ul class="mt-4 space-y-2" v-if="node.children.length">
            <li v-for="child in node.children" :key="child.path">
              <NuxtLink
                :to="child.path"
                class="group inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
              >
                <ChevronRight class="size-3.5 text-white/40 transition group-hover:text-brand-300" />
                {{ child.title }}
              </NuxtLink>
            </li>
          </ul>
        </article>
      </section>

      <section v-else class="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <Star class="mx-auto size-6 text-white/40" />
        <p class="mt-3 text-sm text-white/60">No feature documents found yet in <span class="font-medium text-white">content/features</span>.</p>
      </section>

      <section class="mt-8">
        <p class="mb-3 text-xs text-white/40">
          Comments are page-specific and map to each feature URL.
        </p>
        <GiscusComments />
      </section>
    </main>
  </div>
</template>
