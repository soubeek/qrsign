import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/lib/axios'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

  async function login(email: string, password: string) {
    isLoading.value = true
    try {
      const { data } = await api.post('/auth/login', { email, password })
      accessToken.value = data.accessToken
      user.value = data.user
      localStorage.setItem('access_token', data.accessToken)
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      accessToken.value = null
      user.value = null
      localStorage.removeItem('access_token')
    }
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const { data } = await api.post('/auth/refresh')
      accessToken.value = data.accessToken
      localStorage.setItem('access_token', data.accessToken)
      // Fetch user profile
      const profile = await api.get('/auth/me')
      user.value = profile.data
      return true
    } catch {
      accessToken.value = null
      user.value = null
      localStorage.removeItem('access_token')
      return false
    }
  }

  async function fetchProfile(): Promise<boolean> {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data
      return true
    } catch {
      return false
    }
  }

  return {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
    fetchProfile,
  }
})
