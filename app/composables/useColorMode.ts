/**
 * SSR-safe composable for managing dark/light mode.
 *
 * - Persists preference to `localStorage` under the key `reqcore-color-mode`.
 * - Defaults to OS preference (`prefers-color-scheme: dark`) on first visit.
 * - Toggles the `.dark` class on `<html>` for Tailwind's dark variant.
 *
 * Must be called in `<script setup>` context.
 */
export function useColorMode() {
  const colorMode = useState<'light' | 'dark'>('color-mode', () => 'light')
  const isDark = computed(() => colorMode.value === 'dark')

  function applyClass() {
    if (import.meta.server) return
    if (colorMode.value === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  /** Toggle between light and dark mode. */
  function toggle() {
    colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
    applyClass()
    if (import.meta.client) {
      localStorage.setItem('reqcore-color-mode', colorMode.value)
    }
  }

  /** Set a specific mode. */
  function set(mode: 'light' | 'dark') {
    colorMode.value = mode
    applyClass()
    if (import.meta.client) {
      localStorage.setItem('reqcore-color-mode', mode)
    }
  }

  // Read from localStorage on mount (client only)
  if (import.meta.client) {
    onMounted(() => {
      const stored = localStorage.getItem('reqcore-color-mode') as 'light' | 'dark' | null
      if (stored) {
        colorMode.value = stored
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        colorMode.value = 'dark'
      }
      applyClass()
    })
  }

  return { colorMode, isDark, toggle, set }
}
