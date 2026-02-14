/**
 * Composable for managing the current user's organization context.
 * Provides org list, active org, and org switch/create actions.
 *
 * For session data, use `authClient.useSession(useFetch)` directly.
 * Must be called in `<script setup>` context.
 */
export function useCurrentOrg() {
  // ═══════════════════════════════════════════
  // 1. ORG LIST — reactive hook from Better Auth
  // ═══════════════════════════════════════════
  const orgListState = authClient.useListOrganizations()
  const orgs = computed(() => orgListState.value.data ?? [])

  // ═══════════════════════════════════════════
  // 2. ACTIVE ORG — reactive hook from Better Auth
  // ═══════════════════════════════════════════
  const activeOrgState = authClient.useActiveOrganization()
  const activeOrg = computed(() => activeOrgState.value.data)

  // ═══════════════════════════════════════════
  // 3. ACTIONS
  // ═══════════════════════════════════════════

  /**
   * Switch the active organization for the current session.
   * Reloads the app to reset all cached data.
   */
  async function switchOrg(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId })
    reloadNuxtApp()
  }

  /**
   * Create a new organization and set it as active.
   * Navigates to the dashboard after creation.
   */
  async function createOrg(data: { name: string; slug: string }) {
    const result = await authClient.organization.create({
      name: data.name,
      slug: data.slug,
    })

    if (result.error) {
      throw result.error
    }

    // Better Auth sets the new org as active by default
    await navigateTo('/dashboard')
  }

  // ═══════════════════════════════════════════
  // 4. RETURN
  // ═══════════════════════════════════════════
  return {
    orgs,
    activeOrg,
    switchOrg,
    createOrg,
  }
}
