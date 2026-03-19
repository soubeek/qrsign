import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'

describe('Admin Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should not be authenticated initially', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('login should store token in localStorage', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: 'admin-token', user: { id: '1', email: 'admin@test.com', firstName: 'Admin', lastName: 'Test', role: 'SUPER_ADMIN' } },
    })

    const auth = useAuthStore()
    await auth.login('admin@test.com', 'pass')

    expect(auth.accessToken).toBe('admin-token')
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem('admin_access_token')).toBe('admin-token')
  })

  it('hasRole should check correctly', async () => {
    const auth = useAuthStore()
    auth.user = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ADMIN' }
    auth.accessToken = 'token'

    expect(auth.hasRole('ADMIN')).toBe(true)
    expect(auth.hasRole('SUPER_ADMIN')).toBe(false)
    expect(auth.hasRole('ADMIN', 'OPERATOR')).toBe(true)
  })

  it('refreshAuth should update token and fetch profile', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: 'new-token' } })
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ADMIN' } })

    const auth = useAuthStore()
    await auth.refreshAuth()

    expect(auth.accessToken).toBe('new-token')
    expect(auth.user).not.toBeNull()
  })

  it('logout should clear everything', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })

    const auth = useAuthStore()
    auth.user = { id: '1' } as any
    auth.accessToken = 'token'
    localStorage.setItem('admin_access_token', 'token')

    await auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.accessToken).toBeNull()
    expect(localStorage.getItem('admin_access_token')).toBeNull()
  })
})
