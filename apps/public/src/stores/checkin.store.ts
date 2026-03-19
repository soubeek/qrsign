import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/axios'
import { useConfigStore } from './config.store'

export type ParticipantStatus = 'ABSENT' | 'PRESENT' | 'SIGNED'

export interface Participant {
  id: string
  status: ParticipantStatus
  signedAt: string | null
  data: Record<string, unknown>
  pdfUrl?: string
}

export interface ScanResult {
  participant: Participant
  alreadySigned: boolean
  signedAt?: string
}

export const useCheckinStore = defineStore('checkin', () => {
  const current = ref<Participant | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function getSlug() {
    const configStore = useConfigStore()
    return configStore.slug
  }

  async function scan(qrCode: string): Promise<ScanResult> {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await api.post(`/events/${getSlug()}/checkin/scan`, { qrCode })
      current.value = data.participant
      return data
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data?: { message?: string } } }
      if (axiosErr.response?.status === 404) {
        error.value = 'Badge non reconnu'
      } else if (axiosErr.response?.status === 409) {
        error.value = 'Participant deja signe'
      } else {
        error.value = 'Erreur reseau'
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function loadParticipant(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await api.get(`/events/${getSlug()}/participants/${id}`)
      current.value = data
      return data
    } catch (err) {
      error.value = 'Impossible de charger le participant'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateParticipant(id: string, updates: Record<string, unknown>) {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await api.put(`/events/${getSlug()}/participants/${id}`, { data: updates })
      current.value = data
      return data
    } catch (err) {
      error.value = 'Impossible de mettre a jour le participant'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function sign(id: string, documentDefId: string, signatureData: string) {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await api.post(`/events/${getSlug()}/sign/${id}/${documentDefId}`, {
        signatureData,
      })
      return data
    } catch (err) {
      error.value = 'Erreur lors de la signature'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function sendEmail(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const { data } = await api.post(`/events/${getSlug()}/participants/${id}/email`)
      return data
    } catch (err) {
      error.value = "Erreur lors de l'envoi de l'e-mail"
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function markPresent(id: string) {
    try {
      await api.post(`/events/${getSlug()}/participants/${id}/status`, { status: 'PRESENT' })
    } catch {}
  }

  async function searchParticipants(query: string, limit = 8) {
    const { data } = await api.get(`/events/${getSlug()}/participants`, {
      params: { search: query, limit },
    })
    return data
  }

  async function getStats() {
    const { data } = await api.get(`/events/${getSlug()}/export/stats`)
    return data
  }

  async function getParticipants(params: Record<string, unknown> = {}) {
    const { data } = await api.get(`/events/${getSlug()}/participants`, { params })
    return data
  }

  function clearCurrent() {
    current.value = null
    error.value = null
  }

  return {
    current,
    isLoading,
    error,
    scan,
    loadParticipant,
    markPresent,
    updateParticipant,
    sign,
    sendEmail,
    searchParticipants,
    getStats,
    getParticipants,
    clearCurrent,
  }
})
