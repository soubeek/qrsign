import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/axios'

export const useParticipantsStore = defineStore('participants', () => {
  const participants = ref<any[]>([])
  const fields = ref<any[]>([])
  const isLoading = ref(false)

  async function fetchParticipants(slug: string, params?: { search?: string; status?: string; limit?: number }) {
    isLoading.value = true
    try {
      const { data } = await api.get(`/events/${slug}/participants`, { params })
      participants.value = data.participants || []
      fields.value = data.fields || []
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function updateParticipant(slug: string, participantId: string, payload: any) {
    const { data } = await api.put(`/events/${slug}/participants/${participantId}`, payload)
    const index = participants.value.findIndex((p) => p.id === participantId)
    if (index !== -1) participants.value[index] = data
    return data
  }

  async function sendEmail(slug: string, participantId: string) {
    await api.post(`/events/${slug}/participants/${participantId}/email`)
  }

  return {
    participants,
    fields,
    isLoading,
    fetchParticipants,
    updateParticipant,
    sendEmail,
  }
})
