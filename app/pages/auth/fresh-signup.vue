<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useSeoMeta({ robots: 'noindex, nofollow' })

const localePath = useLocalePath()

onMounted(async () => {
  try {
    // Server-side demo check — avoids client-side auth library quirks
    const { hasSession, isDemo } = await $fetch('/api/auth/demo-check')

    if (!hasSession) {
      window.location.href = localePath('/auth/sign-up')
      return
    }

    if (isDemo) {
      // Sign out the demo session via the auth API directly
      await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
      // Hard navigate to clear all client-side state (Better Auth atoms, Nuxt caches)
      window.location.href = localePath('/auth/sign-up')
    }
    else {
      // Real user — go to dashboard
      window.location.href = localePath('/dashboard')
    }
  }
  catch {
    // On any error, default to sign-up
    window.location.href = localePath('/auth/sign-up')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <p class="text-sm text-surface-500 dark:text-surface-400">Redirecting…</p>
  </div>
</template>
