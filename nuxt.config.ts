// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  vite: {
    // @ts-expect-error - Vite version mismatch between @tailwindcss/vite and Nuxt's bundled Vite
    plugins: [tailwindcss()],
  },

  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-XSS-Protection': '1; mode=block',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        },
      },
      // Allow same-origin framing for inline PDF preview in the sidebar iframe
      '/api/documents/*/preview': {
        headers: {
          'X-Frame-Options': 'SAMEORIGIN',
        },
      },
    },
  },
})
