<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: ['guest'],
})

useSeoMeta({
  title: 'Sign In — Applirank',
  description: 'Sign in to your Applirank account',
})

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSignIn() {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Email and password are required.'
    return
  }

  isLoading.value = true

  const result = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  })

  if (result.error) {
    error.value = result.error.message ?? 'Invalid credentials. Please try again.'
    isLoading.value = false
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <form class="auth-form" @submit.prevent="handleSignIn">
    <h2 class="form-title">Sign in to your account</h2>

    <div v-if="error" class="form-error">{{ error }}</div>

    <label class="form-label">
      <span>Email</span>
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        required
        class="form-input"
      />
    </label>

    <label class="form-label">
      <span>Password</span>
      <input
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        class="form-input"
      />
    </label>

    <button type="submit" :disabled="isLoading" class="form-button">
      {{ isLoading ? 'Signing in…' : 'Sign in' }}
    </button>

    <p class="form-footer">
      Don't have an account?
      <NuxtLink to="/auth/sign-up">Sign up</NuxtLink>
    </p>
  </form>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  text-align: center;
}

.form-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.875rem;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.form-button {
  padding: 0.625rem 1rem;
  background: #111;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}

.form-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-button:hover:not(:disabled) {
  background: #333;
}

.form-footer {
  text-align: center;
  font-size: 0.875rem;
  color: #666;
  margin: 0;
}

.form-footer a {
  color: #2563eb;
  text-decoration: none;
}

.form-footer a:hover {
  text-decoration: underline;
}
</style>
