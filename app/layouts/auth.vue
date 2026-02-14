<template>
  <div class="layout-auth">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-logo">Applirank</h1>
        <p class="auth-tagline">The Sovereign Recruitment Engine</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.layout-auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
  margin: 0;
}

.auth-tagline {
  font-size: 0.875rem;
  color: #666;
  margin: 0.25rem 0 0;
}
</style>
