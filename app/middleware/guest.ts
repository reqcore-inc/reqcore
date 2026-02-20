/**
 * Guest middleware — redirects authenticated users away from auth pages.
 * Apply to sign-in, sign-up, etc. to prevent logged-in users from seeing them.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  if (session.value) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : ''
    const isSafeRedirect = redirect.startsWith('/') && !redirect.startsWith('/auth/')

    return navigateTo(isSafeRedirect ? redirect : '/dashboard')
  }
})
