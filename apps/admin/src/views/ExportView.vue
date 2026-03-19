<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const route = useRoute()
const toast = useToast()
const slug = route.params.slug as string
const stats = ref<any>(null)
const isDownloadingCsv = ref(false)
const isDownloadingPdfs = ref(false)

onMounted(async () => {
  try {
    const { data } = await api.get(`/events/${slug}/export/stats`)
    stats.value = data
  } catch {}
})

async function downloadCsv() {
  isDownloadingCsv.value = true
  try {
    const res = await api.get(`/events/${slug}/export/csv`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ severity: 'success', summary: 'CSV telecharge', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur de telechargement', life: 3000 })
  } finally {
    isDownloadingCsv.value = false
  }
}

async function downloadPdfs() {
  isDownloadingPdfs.value = true
  try {
    const res = await api.get(`/events/${slug}/export/pdfs`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}_pdfs.zip`
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ severity: 'success', summary: 'ZIP telecharge', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur de telechargement', life: 3000 })
  } finally {
    isDownloadingPdfs.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Export</h1>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <i class="pi pi-file text-4xl text-blue-600 mb-3"></i>
        <h2 class="font-semibold mb-2">Export CSV</h2>
        <p class="text-sm text-gray-500 mb-4">Tous les participants</p>
        <Button label="Telecharger" icon="pi pi-download" :loading="isDownloadingCsv" @click="downloadCsv" />
      </div>
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <i class="pi pi-file-pdf text-4xl text-red-600 mb-3"></i>
        <h2 class="font-semibold mb-2">Export PDFs</h2>
        <p class="text-sm text-gray-500 mb-4">Archive ZIP des documents signes</p>
        <Button label="Telecharger" icon="pi pi-download" severity="secondary" :loading="isDownloadingPdfs" @click="downloadPdfs" />
      </div>
      <div v-if="stats" class="bg-white rounded-xl shadow p-6">
        <h2 class="font-semibold mb-4">Statistiques</h2>
        <div class="space-y-3">
          <div class="flex justify-between"><span class="text-gray-500">Total</span><span class="font-bold">{{ stats.total }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Presents</span><span class="font-bold text-blue-600">{{ stats.present }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Signes</span><span class="font-bold text-green-600">{{ stats.signed }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Absents</span><span class="font-bold text-gray-400">{{ stats.absent }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Emails envoyes</span><span class="font-bold">{{ stats.emailSent }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>
