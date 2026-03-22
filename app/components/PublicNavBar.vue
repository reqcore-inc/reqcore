<script setup lang="ts">
import { Github } from 'lucide-vue-next'

defineProps<{
  activePage?: 'features' | 'jobs' | 'roadmap' | 'blog' | 'docs'
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { data: session } = await authClient.useSession(useFetch)
</script>

<template>
  <nav class="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
      <!-- Logo — links to marketing site (reqcore.com) -->
      <a
        :href="useRuntimeConfig().public.marketingUrl"
        class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white"
      >
        <img
          src="/eagle-mascot-logo-128.png"
          alt="Reqcore mascot"
          width="28"
          height="28"
          loading="eager"
          decoding="sync"
          class="h-7 w-7 object-contain"
        />
        Reqcore
      </a>

      <!-- Center nav links (desktop) -->
      <div class="hidden items-center gap-1 md:flex">
        <NuxtLink
          :to="localePath('/jobs')"
          class="rounded-md px-3 py-1.5 text-[13px] font-medium transition"
          :class="activePage === 'jobs' ? 'text-white' : 'text-surface-400 hover:text-white'"
        >
          {{ t('home.nav.openPositions') }}
        </NuxtLink>
        <a
          href="https://github.com/reqcore-inc/reqcore"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white"
        >
          <Github class="h-3.5 w-3.5" />
          {{ t('home.nav.github') }}
        </a>
      </div>

      <!-- Right: session actions + language switcher -->
      <div class="flex items-center gap-2">
        <LanguageSwitcher />
        <template v-if="session?.user">
          <NuxtLink
            :to="localePath('/dashboard')"
            class="rounded-md bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#09090b] transition hover:bg-white/90"
          >
            {{ t('home.nav.dashboard') }}
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink
            :to="localePath('/auth/sign-in')"
            class="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-surface-400 transition hover:text-white sm:inline-flex"
          >
            {{ t('home.nav.logIn') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/auth/sign-up')"
            class="rounded-md bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#09090b] transition hover:bg-white/90"
          >
            {{ t('home.nav.signUp') }}
          </NuxtLink>
        </template>
      </div>
    </div>
  </nav>
</template>
