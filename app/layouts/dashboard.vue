<script setup lang="ts">
const { data: session } = await authClient.useSession(useFetch)
</script>

<template>
  <div class="layout-dashboard">
    <AppSidebar />
    <main class="dashboard-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout-dashboard {
  display: flex;
  min-height: 100vh;
}

.dashboard-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: #f9fafb;
}
</style>
