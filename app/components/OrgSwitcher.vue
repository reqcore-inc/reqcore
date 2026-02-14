<script setup lang="ts">
const { orgs, activeOrg, switchOrg } = useCurrentOrg()
const isOpen = ref(false)
const isSwitching = ref(false)

async function handleSwitch(orgId: string) {
  if (orgId === activeOrg.value?.id) {
    isOpen.value = false
    return
  }

  isSwitching.value = true
  await switchOrg(orgId)
}

/** Close dropdown on outside click */
function onClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('.org-switcher')
  if (!el) isOpen.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="org-switcher">
    <button class="org-trigger" @click="isOpen = !isOpen">
      <span class="org-name">{{ activeOrg?.name ?? 'Select org' }}</span>
      <span class="org-chevron">{{ isOpen ? '▲' : '▼' }}</span>
    </button>

    <div v-if="isOpen" class="org-dropdown">
      <div v-if="isSwitching" class="org-loading">Switching…</div>
      <template v-else>
        <button
          v-for="org in orgs"
          :key="org.id"
          class="org-option"
          :class="{ 'org-option--active': org.id === activeOrg?.id }"
          @click="handleSwitch(org.id)"
        >
          {{ org.name }}
        </button>

        <NuxtLink to="/onboarding/create-org" class="org-option org-option--create" @click="isOpen = false">
          + Create organization
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.org-switcher {
  position: relative;
}

.org-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #111;
  text-align: left;
}

.org-trigger:hover {
  background: #e5e7eb;
}

.org-chevron {
  font-size: 0.625rem;
  color: #6b7280;
}

.org-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  overflow: hidden;
}

.org-loading {
  padding: 0.75rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #6b7280;
}

.org-option {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  font-size: 0.8125rem;
  color: #374151;
  text-align: left;
  cursor: pointer;
  text-decoration: none;
}

.org-option:hover {
  background: #f9fafb;
}

.org-option--active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

.org-option--create {
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.75rem;
}

.org-option--create:hover {
  color: #111;
}
</style>
