import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock axios
vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should not be authenticated initially', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('login should store token and user', async () => {
    const mockResponse = {
      data: {
        accessToken: 'test-token-123',
        user: { id: '1', email: 'test@test.com', firstName: 'Jean', lastName: 'Dupont', role: 'OPERATOR' },
      },
    }
    vi.mocked(api.post).mockResolvedValueOnce(mockResponse)

    const auth = useAuthStore()
    await auth.login('test@test.com', 'password')

    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'test@test.com', password: 'password' })
    expect(auth.accessToken).toBe('test-token-123')
    expect(auth.user?.email).toBe('test@test.com')
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access_token')).toBe('test-token-123')
  })

  it('logout should clear state', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })

    const auth = useAuthStore()
    auth.user = { id: '1', email: 'test@test.com', firstName: 'Jean', lastName: 'Dupont', role: 'OPERATOR' } as any
    auth.accessToken = 'token'
    localStorage.setItem('access_token', 'token')

    await auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.accessToken).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('fetchProfile should load user', async () => {
    const mockUser = { id: '1', email: 'test@test.com', firstName: 'Jean', lastName: 'Dupont', role: 'ADMIN' }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUser })

    const auth = useAuthStore()
    const result = await auth.fetchProfile()

    expect(result).toBe(true)
    expect(auth.user?.role).toBe('ADMIN')
  })

  it('fetchProfile should return false on error', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('401'))

    const auth = useAuthStore()
    const result = await auth.fetchProfile()

    expect(result).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('refreshToken should update token and load profile', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: 'new-token' } })
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'OPERATOR' } })

    const auth = useAuthStore()
    const result = await auth.refreshToken()

    expect(result).toBe(true)
    expect(auth.accessToken).toBe('new-token')
    expect(auth.user).not.toBeNull()
  })

  it('refreshToken should clear state on failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('fail'))

    const auth = useAuthStore()
    auth.accessToken = 'old'
    const result = await auth.refreshToken()

    expect(result).toBe(false)
    expect(auth.accessToken).toBeNull()
  })
})
