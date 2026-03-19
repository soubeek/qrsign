import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/scanner',
      name: 'Scanner',
      component: () => import('@/views/ScannerView.vue'),
    },
    {
      path: '/participant/:id',
      name: 'Participant',
      component: () => import('@/views/ParticipantView.vue'),
    },
    {
      path: '/signature/:id',
      name: 'Signature',
      component: () => import('@/views/SignatureView.vue'),
    },
    {
      path: '/confirmation/:id',
      name: 'Confirmation',
      component: () => import('@/views/ConfirmationView.vue'),
    },
  ],
})

let initialized = false

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const auth = useAuthStore()

  if (!initialized) {
    initialized = true
    if (auth.accessToken) {
      const ok = await auth.fetchProfile()
      if (!ok) {
        const refreshed = await auth.refreshToken()
        if (!refreshed) return { path: '/login' }
      }
    } else {
      const refreshed = await auth.refreshToken()
      if (!refreshed) return { path: '/login' }
    }
    // Load event config after auth
    const config = useConfigStore()
    if (!config.config) {
      try { await config.loadConfig() } catch { /* will retry */ }
    }
  }

  if (!auth.isAuthenticated) {
    return { path: '/login' }
  }

  return true
})

export default router
