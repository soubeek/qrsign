import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/lib/axios'
import { useEventsStore } from '@/stores/events.store'

describe('Events Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchEvents should populate events array', async () => {
    const mockEvents = [
      { id: '1', slug: 'event-1', title: 'Event 1', isActive: true },
      { id: '2', slug: 'event-2', title: 'Event 2', isActive: false },
    ]
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockEvents })

    const store = useEventsStore()
    await store.fetchEvents()

    expect(store.events).toHaveLength(2)
    expect(store.events[0].title).toBe('Event 1')
  })

  it('fetchEvent should set currentEvent', async () => {
    const mockEvent = { id: '1', slug: 'test', title: 'Test Event', documents: [], fields: [] }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockEvent })

    const store = useEventsStore()
    await store.fetchEvent('test')

    expect(store.currentEvent?.title).toBe('Test Event')
  })

  it('createEvent should add to list', async () => {
    const newEvent = { id: '3', slug: 'new', title: 'New Event' }
    vi.mocked(api.post).mockResolvedValueOnce({ data: newEvent })

    const store = useEventsStore()
    store.events = [{ id: '1', slug: 'old', title: 'Old' } as any]

    await store.createEvent({ title: 'New Event', slug: 'new' } as any)

    expect(store.events).toHaveLength(2)
    expect(api.post).toHaveBeenCalledWith('/events', expect.objectContaining({ title: 'New Event' }))
  })

  it('updateEvent should update in list', async () => {
    const updated = { id: '1', slug: 'test', title: 'Updated' }
    vi.mocked(api.patch).mockResolvedValueOnce({ data: updated })

    const store = useEventsStore()
    store.events = [{ id: '1', slug: 'test', title: 'Old' } as any]
    store.currentEvent = store.events[0]

    await store.updateEvent('test', { title: 'Updated' } as any)

    expect(store.events[0].title).toBe('Updated')
    expect(store.currentEvent?.title).toBe('Updated')
  })

  it('deleteEvent should remove from list', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} })

    const store = useEventsStore()
    store.events = [{ id: '1', slug: 'test', title: 'Test' } as any]

    await store.deleteEvent('test')

    expect(store.events).toHaveLength(0)
  })
})
