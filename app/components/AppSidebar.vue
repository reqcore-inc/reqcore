<script setup lang="ts">
const { data: session } = await authClient.useSession(useFetch)
const isSigningOut = ref(false)

const userName = computed(() => session.value?.user?.name ?? 'User')
const userEmail = computed(() => session.value?.user?.email ?? '')

async function handleSignOut() {
  isSigningOut.value = true
  await authClient.signOut()
  await navigateTo('/auth/sign-in')
}

const navItems = [
  { label: 'Dashboard', to: '/dashboard', enabled: true },
  { label: 'Jobs', to: '/dashboard/jobs', enabled: true },
  { label: 'Candidates', to: '/dashboard/candidates', enabled: false },
  { label: 'Applications', to: '/dashboard/applications', enabled: false },
]
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="sidebar-logo">Applirank</div>

      <div class="sidebar-org">
        <OrgSwitcher />
      </div>

      <nav class="sidebar-nav">
        <template v-for="item in navItems" :key="item.to">
          <NuxtLink
            v-if="item.enabled"
            :to="item.to"
            class="nav-link"
            active-class="nav-link--active"
          >
            {{ item.label }}
          </NuxtLink>
          <span v-else class="nav-link nav-link--disabled">
            {{ item.label }}
          </span>
        </template>
      </nav>
    </div>

    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-name">{{ userName }}</div>
        <div class="user-email">{{ userEmail }}</div>
      </div>
      <button class="sign-out-button" :disabled="isSigningOut" @click="handleSignOut">
        {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 240px;
  min-width: 240px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  padding: 1.25rem 0.75rem;
  overflow-y: auto;
}

.sidebar-top {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sidebar-logo {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111;
  padding: 0 0.5rem;
}

.sidebar-org {
  padding: 0;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-link {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #374151;
  text-decoration: none;
  transition: background 0.1s;
}

.nav-link:hover {
  background: #f3f4f6;
}

.nav-link--active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

.nav-link--disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.nav-link--disabled:hover {
  background: none;
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.sidebar-user {
  padding: 0 0.5rem;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111;
}

.user-email {
  font-size: 0.75rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sign-out-button {
  padding: 0.375rem 0.75rem;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #374151;
  cursor: pointer;
}

.sign-out-button:hover:not(:disabled) {
  background: #f9fafb;
}

.sign-out-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
