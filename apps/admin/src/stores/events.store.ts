import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/axios'
import type { Event } from '@/lib/types'

export const useEventsStore = defineStore('events', () => {
  const events = ref<Event[]>([])
  const currentEvent = ref<Event | null>(null)
  const isLoading = ref(false)

  async function fetchEvents() {
    isLoading.value = true
    try {
      const { data } = await api.get('/events')
      events.value = data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchEvent(slug: string) {
    isLoading.value = true
    try {
      const { data } = await api.get(`/events/${slug}`)
      currentEvent.value = data
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function createEvent(payload: Partial<Event>) {
    const { data } = await api.post('/events', payload)
    events.value.push(data)
    return data
  }

  async function updateEvent(slug: string, payload: Partial<Event>) {
    const { data } = await api.patch(`/events/${slug}`, payload)
    const index = events.value.findIndex((e) => e.slug === slug)
    if (index !== -1) events.value[index] = data
    if (currentEvent.value?.slug === slug) currentEvent.value = data
    return data
  }

  async function deleteEvent(slug: string) {
    await api.delete(`/events/${slug}`)
    events.value = events.value.filter((e) => e.slug !== slug)
    if (currentEvent.value?.slug === slug) currentEvent.value = null
  }

  return {
    events,
    currentEvent,
    isLoading,
    fetchEvents,
    fetchEvent,
    createEvent,
    updateEvent,
    deleteEvent,
  }
})
