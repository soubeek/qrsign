<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../stores/auth.store'
import api from '../lib/axios'

const route = useRoute()
const toast = useToast()
const auth = useAuthStore()
const slug = route.params.slug as string
const stats = ref<any>(null)

onMounted(async () => {
  try {
    const { data } = await api.get(`/events/${slug}/export/stats`)
    stats.value = data
  } catch {}
})

function directDownload(path: string) {
  // Open direct link with token in query param — browser handles streaming natively
  const url = `/api${path}?token=${auth.accessToken}`
  window.open(url, '_blank')
}

function downloadCsv() { directDownload(`/events/${slug}/export/csv`) }
function downloadPdfs() { directDownload(`/events/${slug}/export/pdfs`) }
function downloadBadges() { directDownload(`/events/${slug}/participants/badges`) }
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Export</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <i class="pi pi-file text-4xl text-blue-600 mb-3"></i>
        <h2 class="font-semibold mb-2">Export CSV</h2>
        <p class="text-sm text-gray-500 mb-4">Tous les participants</p>
        <Button label="Telecharger" icon="pi pi-download" @click="downloadCsv" />
      </div>
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <i class="pi pi-qrcode text-4xl text-purple-600 mb-3"></i>
        <h2 class="font-semibold mb-2">Badges QR</h2>
        <p class="text-sm text-gray-500 mb-4">PDF avec QR codes pour impression</p>
        <Button label="Telecharger" icon="pi pi-download" severity="help" @click="downloadBadges" />
      </div>
      <div class="bg-white rounded-xl shadow p-6 text-center">
        <i class="pi pi-file-pdf text-4xl text-red-600 mb-3"></i>
        <h2 class="font-semibold mb-2">Export PDFs</h2>
        <p class="text-sm text-gray-500 mb-4">Archive ZIP des documents signes</p>
        <Button label="Telecharger" icon="pi pi-download" severity="secondary" @click="downloadPdfs" />
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
