---
name: tailwind-v4-skill
description: Tailwind CSS v4 styling patterns for Nuxt 4 projects. Use this skill when writing or modifying Vue component templates, creating pages, authoring CSS, or reviewing styling code. Covers @tailwindcss/vite setup, @theme customization, utility-first patterns, and common pitfalls.
---

# Tailwind CSS v4 Skill for Nuxt 4

> **Purpose**: Ensures AI agents write correct Tailwind CSS v4 code in Nuxt 4 projects, avoiding
> outdated v3 patterns and common class-generation pitfalls.
> **Last verified**: February 2026 | Tailwind CSS v4.1+

---

## 1. Critical Context: Tailwind v4 vs v3

Tailwind CSS v4 was released in early 2025 as a ground-up rewrite. If you have training data from
Tailwind v3, **many patterns are now outdated**. Always prefer the patterns in this skill.

### Key Differences at a Glance

| Area | Tailwind v3 (Old) | Tailwind v4 (Current) |
|---|---|---|
| Configuration | `tailwind.config.js` | `@theme` directive in CSS |
| Import syntax | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Content scanning | Manual `content` array in config | Automatic — scans all source files |
| Nuxt integration | `@nuxtjs/tailwindcss` module | `@tailwindcss/vite` Vite plugin |
| PostCSS config | Required `postcss.config.js` | Not needed — Vite plugin handles it |
| Custom colors | `theme.extend.colors` in config | `--color-*` in `@theme` |
| Custom fonts | `theme.extend.fontFamily` in config | `--font-*` in `@theme` |
| Custom spacing | `theme.extend.spacing` in config | `--spacing-*` in `@theme` |
| Dark mode config | `darkMode: 'class'` in config | `@custom-variant dark (...)` in CSS |
| CSS variables | Opt-in via `theme.cssVariables` | Always generated as CSS custom properties |
| Engine | PostCSS plugin (JS) | Rust-based engine (Lightning CSS) |

---

## 2. Setup in Nuxt 4

### Required packages

```bash
npm install tailwindcss @tailwindcss/vite
```

### nuxt.config.ts

```ts
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
})
```

### CSS entry point: `app/assets/css/main.css`

```css
@import "tailwindcss";

@theme {
  /* Custom design tokens go here */
  --color-brand-500: oklch(62.3% 0.214 259.815);
}
```

### Files that should NOT exist

- `tailwind.config.js` / `tailwind.config.ts` — v3 config format, not used
- `postcss.config.js` / `postcss.config.mjs` — not needed with Vite plugin
- Any mention of `@nuxtjs/tailwindcss` in `nuxt.config.ts` modules

---

## 3. The `@theme` Directive — Zero-Config Custom Design Tokens

In v4, all customization happens via `@theme` blocks in CSS files. The `@theme` directive defines
CSS custom properties that Tailwind maps to utility classes.

### Adding new design tokens

```css
@import "tailwindcss";

@theme {
  /* Each variable creates corresponding utilities */
  --color-primary: oklch(62.3% 0.214 259.815);  /* → bg-primary, text-primary */
  --font-heading: "Inter", sans-serif;            /* → font-heading */
  --radius-pill: 9999px;                          /* → rounded-pill */
  --shadow-card: 0 1px 3px rgb(0 0 0 / 0.1);    /* → shadow-card */
}
```

### Overriding default theme values

```css
@theme {
  /* Override a single value */
  --breakpoint-sm: 30rem;

  /* Clear an entire namespace and replace */
  --color-*: initial;
  --color-white: #fff;
  --color-black: #000;
  --color-brand: #3f3cbb;
}
```

### Referencing theme variables in custom CSS

```css
@layer components {
  .prose h1 {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-gray-900);
  }
}
```

---

## 4. Critical Rule: Complete Class Names

Tailwind v4's engine scans source files for complete, unbroken class names. **Dynamic class name
construction will fail** — the classes won't be generated in the CSS output.

```ts
// ❌ BROKEN — Tailwind cannot detect dynamically constructed class names
const bgClass = `bg-${status}-500`

// ❌ BROKEN — template literal interpolation
`text-${size}`

// ✅ WORKS — use a lookup map with complete class names
const statusColors = {
  active: 'bg-green-500 text-white',
  draft: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800',
} as const

// ✅ WORKS — ternary with complete class names
isActive ? 'bg-green-500' : 'bg-gray-200'

// ✅ WORKS — array of complete class names
:class="['px-4 py-2', isLarge ? 'text-lg' : 'text-sm']"
```

---

## 5. Vue Integration Patterns

### Static classes

```vue
<button class="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">
  Save
</button>
```

### Conditional classes with `:class`

```vue
<!-- Object syntax -->
<div :class="{ 'opacity-50 pointer-events-none': isDisabled }">

<!-- Array syntax -->
<div :class="['rounded-lg p-4', isActive ? 'bg-brand-50' : 'bg-gray-50']">

<!-- Combined static + dynamic -->
<div class="rounded-lg p-4" :class="isActive ? 'bg-brand-50' : 'bg-gray-50'">
```

### Avoid `<style scoped>` for Tailwind-covered styling

```vue
<!-- ✅ DO: utility classes directly -->
<template>
  <aside class="flex flex-col justify-between w-60 min-w-60 bg-white border-r border-gray-200 py-5 px-3">
    <nav class="flex flex-col gap-1">
      <NuxtLink class="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Dashboard</NuxtLink>
    </nav>
  </aside>
</template>

<!-- ❌ DON'T: scoped CSS for things Tailwind handles -->
<style scoped>
.sidebar { display: flex; width: 240px; border-right: 1px solid #e5e7eb; }
</style>
```

---

## 6. Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Creating `tailwind.config.js` | Use `@theme` in `app/assets/css/main.css` |
| Using `@tailwind base;` syntax | Use `@import "tailwindcss"` |
| Dynamic class concatenation | Use complete class name maps |
| Adding `@nuxtjs/tailwindcss` to modules | Use `@tailwindcss/vite` in `vite.plugins` |
| `@apply` in `<style scoped>` blocks | Put reusable classes in `main.css` `@layer components` |
| Using `postcss.config.js` | Not needed — Vite plugin handles it |
| Wrapping utility values in `theme()` function | Use `var(--color-*)` CSS variables instead |
| Referencing `theme.extend.*` patterns | That's v3 — use `@theme` directive |
