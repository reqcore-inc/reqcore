<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Dashboard — Applirank',
  description: 'Your recruitment overview',
})

const { activeOrg } = useCurrentOrg()
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard-title">
      Welcome to Applirank
    </h1>
    <p v-if="activeOrg" class="dashboard-org">
      Organization: <strong>{{ activeOrg.name }}</strong>
    </p>

    <div class="dashboard-placeholder">
      <p>
        Your recruitment dashboard will appear here once Job Management is implemented (Milestone 3).
      </p>
      <p>
        Use the sidebar to navigate — Jobs, Candidates, and Applications will be available in upcoming milestones.
      </p>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 640px;
}

.dashboard-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
  margin: 0;
}

.dashboard-org {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}

.dashboard-placeholder {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #374151;
  font-size: 0.875rem;
  line-height: 1.6;
}

.dashboard-placeholder p {
  margin: 0 0 0.75rem;
}

.dashboard-placeholder p:last-child {
  margin-bottom: 0;
}
</style>
