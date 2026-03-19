import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/lib/axios'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('admin_access_token'))
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)
  const userRole = computed(() => user.value?.role ?? null)

  function hasRole(...roles: string[]): boolean {
    if (!user.value) return false
    return roles.includes(user.value.role)
  }

  async function login(email: string, password: string) {
    isLoading.value = true
    try {
      const { data } = await api.post('/auth/login', { email, password })
      accessToken.value = data.accessToken
      user.value = data.user
      localStorage.setItem('admin_access_token', data.accessToken)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProfile() {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data
    } catch {
      user.value = null
    }
  }

  async function refreshAuth() {
    try {
      const { data } = await api.post('/auth/refresh')
      accessToken.value = data.accessToken
      localStorage.setItem('admin_access_token', data.accessToken)
      await fetchProfile()
    } catch {
      accessToken.value = null
      user.value = null
      localStorage.removeItem('admin_access_token')
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      accessToken.value = null
      user.value = null
      localStorage.removeItem('admin_access_token')
    }
  }

  return {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    userRole,
    hasRole,
    login,
    fetchProfile,
    refreshAuth,
    logout,
  }
})
