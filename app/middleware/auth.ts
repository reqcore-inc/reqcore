/**
 * Auth middleware — redirects unauthenticated users to sign-in.
 * Apply to any page that requires a logged-in user.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    return navigateTo('/auth/sign-in')
  }
})
