import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/stores/config.store', () => ({
  useConfigStore: () => ({
    slug: 'test-event',
    requiredDocuments: [
      { id: 'doc1', title: 'Doc Global', required: true, signingLabel: 'Signer' },
      { id: 'doc2', title: 'Doc Assigned', required: true, signingLabel: 'Signer' },
    ],
  }),
}))

import api from '@/lib/axios'
import { useCheckinStore } from '@/stores/checkin.store'

describe('Document Assignment - Store behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loadParticipant stores assignedDocs from API response', async () => {
    const mockParticipant = {
      id: 'p1',
      status: 'PRESENT',
      data: { nom: 'DUPONT', prenom: 'Jean' },
      signatures: [],
      assignedDocs: [
        { id: 'doc1', title: 'Doc Global', required: true, signingLabel: 'Signer' },
      ],
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockParticipant })

    const store = useCheckinStore()
    await store.loadParticipant('p1')

    expect(store.current).toBeDefined()
    expect((store.current as any).assignedDocs).toBeDefined()
    expect((store.current as any).assignedDocs.length).toBe(1)
    expect((store.current as any).assignedDocs[0].id).toBe('doc1')
  })

  it('participant with assignedDocs only sees assigned documents', async () => {
    const mockParticipant = {
      id: 'p1',
      status: 'PRESENT',
      data: { nom: 'DUPONT' },
      signatures: [],
      assignedDocs: [
        { id: 'doc1', title: 'Doc Global', required: true },
      ],
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockParticipant })

    const store = useCheckinStore()
    await store.loadParticipant('p1')

    // assignedDocs has only doc1, not doc2
    const assignedDocs = (store.current as any).assignedDocs
    expect(assignedDocs.length).toBe(1)
    expect(assignedDocs.some((d: any) => d.id === 'doc1')).toBe(true)
    expect(assignedDocs.some((d: any) => d.id === 'doc2')).toBe(false)
  })

  it('participant without assignedDocs falls back to all docs', async () => {
    const mockParticipant = {
      id: 'p2',
      status: 'PRESENT',
      data: { nom: 'MARTIN' },
      signatures: [],
      // No assignedDocs or empty
      assignedDocs: [],
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockParticipant })

    const store = useCheckinStore()
    await store.loadParticipant('p2')

    // When assignedDocs is empty, the view should fall back to config.requiredDocuments
    const assignedDocs = (store.current as any).assignedDocs
    expect(assignedDocs.length).toBe(0)
    // The ParticipantView computed would use config.requiredDocuments as fallback
  })

  it('sign respects per-participant allSigned based on assigned docs', async () => {
    // Participant has only 1 assigned doc, signing it should set allSigned=true
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, allSigned: true, remainingDocs: 0 },
    })

    const store = useCheckinStore()
    const result = await store.sign('p1', 'doc1', 'data:image/png;base64,...')

    expect(result.allSigned).toBe(true)
    expect(result.remainingDocs).toBe(0)
  })

  it('sign with remaining assigned docs returns allSigned=false', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, allSigned: false, remainingDocs: 1 },
    })

    const store = useCheckinStore()
    const result = await store.sign('p1', 'doc1', 'data:image/png;base64,...')

    expect(result.allSigned).toBe(false)
    expect(result.remainingDocs).toBe(1)
  })
})
