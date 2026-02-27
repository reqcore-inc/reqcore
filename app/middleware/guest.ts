/**
 * Guest middleware — redirects authenticated users away from auth pages.
 * Apply to sign-in, sign-up, etc. to prevent logged-in users from seeing them.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { data: session } = await authClient.useSession(useFetch)
  const localePath = useLocalePath()

  if (session.value) {
    return navigateTo(localePath('/dashboard'))
  }
})
