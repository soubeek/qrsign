import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

import api from '@/lib/axios'
import { useConfigStore } from '@/stores/config.store'

describe('Config Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should have null config initially', () => {
    const config = useConfigStore()
    expect(config.config).toBeNull()
    expect(config.fields).toEqual([])
    expect(config.documents).toEqual([])
  })

  it('loadConfig should fetch and map data correctly', async () => {
    const mockResponse = {
      data: {
        event: { title: 'Test Event', subtitle: null, logoEmoji: '🏛️', entitySingular: 'elu', entityPlural: 'elus', displayNameTpl: '{nom}', searchFields: ['nom'] },
        fields: [
          { key: 'nom', label: 'Nom', type: 'TEXT', required: true, editable: true, displayInList: true },
          { key: 'email', label: 'Email', type: 'EMAIL', required: false, editable: true, displayInList: false },
        ],
        documents: [
          { id: 'doc1', title: 'Consentement', signingLabel: 'Signer', required: true, displayOrder: 0 },
          { id: 'doc2', title: 'Charte', signingLabel: 'Signer la charte', required: false, displayOrder: 1 },
        ],
        email: { autoSendOnSign: false, allowManualSend: true },
      },
    }
    vi.mocked(api.get).mockResolvedValueOnce(mockResponse)

    const config = useConfigStore()
    await config.loadConfig('test-event')

    expect(config.slug).toBe('test-event')
    expect(config.config?.app?.title).toBe('Test Event')
    expect(config.config?.app?.emoji).toBe('🏛️')
    expect(config.fields).toHaveLength(2)
    expect(config.fields[0].type).toBe('text') // normalized to lowercase
    expect(config.documents).toHaveLength(2)
    expect(config.requiredDocuments).toHaveLength(1)
    expect(config.listFields).toHaveLength(1)
  })

  it('loadConfig should throw without slug', async () => {
    const config = useConfigStore()
    config.slug = ''
    await expect(config.loadConfig()).rejects.toThrow('No event slug')
  })
})
