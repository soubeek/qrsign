<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import Button from 'primevue/button'
import api from '../lib/axios'

const route = useRoute()
const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()
const participantId = route.params.id as string
const countdown = ref(15)
const emailSent = ref(false)
const emailSending = ref(false)
const emailError = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const participant = computed(() => checkin.current)
const signatures = computed(() => (participant.value as any)?.signatures || [])

const participantName = computed(() => {
  if (!participant.value?.data) return ''
  const d = (participant.value.data || {}) as Record<string, any>
  return `${d['prenom'] || ''} ${d['nom'] || ''}`.trim()
})

async function downloadPdf(docId: string) {
  try {
    const res = await api.get(`/events/${config.slug}/participants/${participantId}/pdf/${docId}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `document-${docId}.pdf`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch {}
}

async function sendEmail() {
  emailSending.value = true; emailError.value = ''
  try { await checkin.sendEmail(participantId); emailSent.value = true }
  catch { emailError.value = "Erreur lors de l'envoi" }
  finally { emailSending.value = false }
}

function newScan() { checkin.clearCurrent(); router.push('/scanner') }

onMounted(async () => {
  if (!participant.value || participant.value.id !== participantId) await checkin.loadParticipant(participantId)
  timer = setInterval(() => { countdown.value--; if (countdown.value <= 0) newScan() }, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="app-fixed-layout bg-gray-50 items-center justify-center p-4" style="overflow-y: auto !important;">
    <div class="max-w-lg w-full">
      <div class="bg-white rounded-xl shadow p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <i class="pi pi-check text-green-600 text-3xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-green-700 mb-2">Tous les documents signes</h1>
        <p v-if="participantName" class="text-gray-600 mb-6">{{ participantName }}</p>

        <!-- List of signed documents with download -->
        <div v-if="signatures.length > 0" class="space-y-2 mb-6 text-left">
          <div v-for="sig in signatures" :key="sig.id" class="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div class="flex items-center gap-2">
              <i class="pi pi-check-circle text-green-600"></i>
              <span class="text-sm font-medium">{{ sig.documentDef?.title || 'Document' }}</span>
            </div>
            <Button icon="pi pi-download" severity="info" text size="small" @click="downloadPdf(sig.documentDefId)" />
          </div>
        </div>

        <div class="space-y-3">
          <div v-if="config.config?.email?.autoSendOnSign" class="p-3 bg-blue-50 rounded-lg text-blue-700 text-sm">
            Documents envoyes par e-mail
          </div>
          <div v-if="emailSent" class="p-3 bg-green-50 rounded-lg text-green-700 text-sm">Email envoye</div>
          <Button v-if="config.config?.email?.allowManualSend && !config.config?.email?.autoSendOnSign && !emailSent"
            label="Envoyer par e-mail" icon="pi pi-envelope" severity="secondary" class="w-full"
            :loading="emailSending" @click="sendEmail" />
          <div v-if="emailError" class="text-red-600 text-sm">{{ emailError }}</div>
        </div>

        <div class="mt-8">
          <Button label="Nouveau scan" icon="pi pi-qrcode" severity="success" class="w-full" size="large" @click="newScan" />
          <p class="text-gray-400 text-sm mt-3">Retour automatique dans {{ countdown }}s</p>
        </div>
      </div>
    </div>
  </div>
</template>
