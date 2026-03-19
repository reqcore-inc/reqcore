<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useSeoMeta({ robots: 'noindex, nofollow' })

const localePath = useLocalePath()

onMounted(async () => {
  try {
    // Check if there's an existing session and whether it's a demo org
    const { hasSession, isDemo } = await $fetch('/api/auth/demo-check')

    if (!hasSession) {
      window.location.href = localePath('/auth/sign-up')
      return
    }

    if (isDemo) {
      // Sign out using the Better Auth client SDK — the same method
      // that works in AppTopBar. This properly handles CSRF tokens,
      // cookie clearing, and internal auth state, unlike raw $fetch
      // to the sign-out endpoint which bypasses all of that.
      await authClient.signOut()
      clearNuxtData()
      // Hard navigate to fully reset all client-side state
      window.location.href = localePath('/auth/sign-up')
    }
    else {
      // Real user with a non-demo account — go to dashboard
      window.location.href = localePath('/dashboard')
    }
  }
  catch {
    window.location.href = localePath('/auth/sign-up')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <p class="text-sm text-surface-500 dark:text-surface-400">Redirecting…</p>
  </div>
</template>
