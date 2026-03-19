import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
  }
}

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      redirect: '/events',
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/EventsView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug',
      name: 'event-detail',
      component: () => import('@/views/EventDetailView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'] },
    },
    {
      path: '/events/:slug/config',
      name: 'event-config',
      component: () => import('@/views/EventConfigView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug/config/fields',
      name: 'fields-builder',
      component: () => import('@/views/FieldsBuilderView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug/config/document',
      name: 'document-editor',
      component: () => import('@/views/DocumentEditorView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug/config/email',
      name: 'email-settings',
      component: () => import('@/views/EmailSettingsView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug/participants',
      name: 'participants',
      component: () => import('@/views/ParticipantsView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'] },
    },
    {
      path: '/events/:slug/import',
      name: 'import',
      component: () => import('@/views/ImportView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] },
    },
    {
      path: '/events/:slug/export',
      name: 'export',
      component: () => import('@/views/ExportView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
    },
  ],
})

let authInitialized = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // On first load, try to restore session
  if (!authInitialized) {
    authInitialized = true
    if (!auth.isAuthenticated) {
      try {
        await auth.refreshAuth()
      } catch {
        // No valid session - that's OK, we'll redirect to login below
      }
    }
  }

  // Login page: redirect to events if already authenticated
  if (to.meta.requiresAuth === false) {
    if (auth.isAuthenticated) return { name: 'events' }
    return true
  }

  // Protected routes: redirect to login if not authenticated
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Role check
  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!auth.hasRole(...to.meta.roles)) {
      return { name: 'events' }
    }
  }

  return true
})

export default router
