/**
 * Nitro plugin: recompute public auth-provider flags at server startup.
 *
 * The runtimeConfig.public booleans (authGoogleEnabled, authGithubEnabled, …)
 * are evaluated at **build time** from process.env. When the Docker image is
 * built without OAuth credentials (e.g. Railway injects them at runtime),
 * those flags are baked in as `false` and the sign-in buttons never appear.
 *
 * This plugin runs once at startup and patches the public runtimeConfig so
 * SSR-rendered pages (and the serialised `__NUXT__` payload) reflect the
 * actual runtime environment.
 */
export default defineNitroPlugin(() => {
  const cfg = useRuntimeConfig();

  cfg.public.authGoogleEnabled = !!(
    process.env.AUTH_GOOGLE_CLIENT_ID &&
    process.env.AUTH_GOOGLE_CLIENT_SECRET
  );

  cfg.public.authGithubEnabled = !!(
    process.env.AUTH_GITHUB_CLIENT_ID &&
    process.env.AUTH_GITHUB_CLIENT_SECRET
  );

  cfg.public.authMicrosoftEnabled = !!(
    process.env.AUTH_MICROSOFT_CLIENT_ID &&
    process.env.AUTH_MICROSOFT_CLIENT_SECRET
  );

  cfg.public.oidcEnabled = !!(
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_DISCOVERY_URL
  );

  cfg.public.feedbackEnabled = !!(
    process.env.GITHUB_FEEDBACK_TOKEN &&
    process.env.GITHUB_FEEDBACK_REPO
  );
});
