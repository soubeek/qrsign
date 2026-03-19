import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/axios'
import type { FieldDef } from '@/lib/types'

export const useFieldsStore = defineStore('fields', () => {
  const fields = ref<FieldDef[]>([])
  const isLoading = ref(false)

  async function fetchFields(slug: string) {
    isLoading.value = true
    try {
      const { data } = await api.get(`/events/${slug}/fields`)
      fields.value = data
    } finally {
      isLoading.value = false
    }
  }

  async function createField(slug: string, payload: Partial<FieldDef>) {
    const { data } = await api.post(`/events/${slug}/fields`, payload)
    fields.value.push(data)
    return data
  }

  async function updateField(slug: string, fieldId: string, payload: Partial<FieldDef>) {
    const { data } = await api.put(`/events/${slug}/fields/${fieldId}`, payload)
    const index = fields.value.findIndex((f) => f.id === fieldId)
    if (index !== -1) fields.value[index] = data
    return data
  }

  async function deleteField(slug: string, fieldId: string) {
    await api.delete(`/events/${slug}/fields/${fieldId}`)
    fields.value = fields.value.filter((f) => f.id !== fieldId)
  }

  async function reorderFields(slug: string, items: { id: string; displayOrder: number }[]) {
    await api.post(`/events/${slug}/fields/reorder`, { items })
    // Update local state
    for (const item of items) {
      const field = fields.value.find((f) => f.id === item.id)
      if (field) field.displayOrder = item.displayOrder
    }
    fields.value.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  }

  return {
    fields,
    isLoading,
    fetchFields,
    createField,
    updateField,
    deleteField,
    reorderFields,
  }
})
