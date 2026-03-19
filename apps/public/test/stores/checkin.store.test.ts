import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('@/stores/config.store', () => ({
  useConfigStore: () => ({ slug: 'test-event' }),
}))

import api from '@/lib/axios'
import { useCheckinStore } from '@/stores/checkin.store'

describe('Checkin Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('scan should call checkin endpoint', async () => {
    const mockResult = { participant: { id: 'p1', status: 'PRESENT', data: { nom: 'DUPONT' } }, fieldDefs: [], documents: [] }
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockResult })

    const store = useCheckinStore()
    const result = await store.scan('QR-001')

    expect(api.post).toHaveBeenCalledWith('/events/test-event/checkin/scan', { qrCode: 'QR-001' })
    expect(store.current?.id).toBe('p1')
  })

  it('scan should set error on 404', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 404 } })

    const store = useCheckinStore()
    await expect(store.scan('INVALID')).rejects.toBeTruthy()
    expect(store.error).toBe('Badge non reconnu')
  })

  it('sign should call correct endpoint', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, allSigned: false, remainingDocs: 1 } })

    const store = useCheckinStore()
    const result = await store.sign('p1', 'doc1', 'data:image/png;base64,...')

    expect(api.post).toHaveBeenCalledWith('/events/test-event/sign/p1/doc1', { signatureData: 'data:image/png;base64,...' })
    expect(result.allSigned).toBe(false)
  })

  it('loadParticipant should store current', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'p1', status: 'PRESENT', data: { nom: 'TEST' }, signatures: [] } })

    const store = useCheckinStore()
    await store.loadParticipant('p1')

    expect(store.current?.id).toBe('p1')
  })

  it('markPresent should call status endpoint', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })

    const store = useCheckinStore()
    await store.markPresent('p1')

    expect(api.post).toHaveBeenCalledWith('/events/test-event/participants/p1/status', { status: 'PRESENT' })
  })

  it('clearCurrent should reset state', () => {
    const store = useCheckinStore()
    store.current = { id: 'p1', status: 'PRESENT', data: {}, signedAt: null } as any
    store.error = 'some error'

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.error).toBeNull()
  })
})
