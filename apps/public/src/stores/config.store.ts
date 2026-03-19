import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/lib/axios'

export interface FieldDef {
  key: string; label: string; type: string; required: boolean
  editable: boolean; displayInList: boolean; options?: string[]
}
export interface NoticeSection { title: string; content: string }
export interface DocumentConfig {
  id: string; title: string; signingLabel: string
  declarationTemplate: string; noticeSections: NoticeSection[]
  pdfFooterText: string; displayOrder: number; required: boolean
}
export interface EmailConfig { autoSendOnSign: boolean; allowManualSend: boolean }
export interface AppSettings {
  title: string; subtitle: string | null; logoEmoji: string; emoji: string
  entitySingular: string; entityPlural: string
  displayNameTpl: string; searchFields: string[]
}
export interface EventConfig {
  app: AppSettings; fields: FieldDef[]
  documents: DocumentConfig[]; email: EmailConfig | null
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<EventConfig | null>(null)
  const isLoading = ref(false)
  const slug = ref<string>(import.meta.env.VITE_EVENT_SLUG || 'conseil-municipal')

  const fields = computed(() => config.value?.fields ?? [])
  const listFields = computed(() => fields.value.filter(f => f.displayInList))
  const documents = computed(() => config.value?.documents ?? [])
  const requiredDocuments = computed(() => documents.value.filter(d => d.required))

  async function loadConfig(eventSlug?: string) {
    const s = eventSlug || slug.value
    if (!s) throw new Error('No event slug provided')
    slug.value = s
    isLoading.value = true
    try {
      const { data } = await api.get(`/events/${s}/config`)
      config.value = {
        app: { ...data.event, emoji: data.event.logoEmoji },
        fields: (data.fields || []).map((f: any) => ({ ...f, type: f.type.toLowerCase() })),
        documents: data.documents || [],
        email: data.email,
      }
    } finally {
      isLoading.value = false
    }
  }

  return { config, slug, isLoading, fields, listFields, documents, requiredDocuments, loadConfig }
})
