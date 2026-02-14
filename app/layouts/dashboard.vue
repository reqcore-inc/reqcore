<script setup lang="ts">
const { data: session } = await authClient.useSession(useFetch)
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto bg-surface-50 px-6 py-8">
      <div class="mx-auto max-w-4xl">
        <slot />
      </div>
    </main>
  </div>
</template>
