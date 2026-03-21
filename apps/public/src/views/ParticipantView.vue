<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import api from '../lib/axios'

const route = useRoute()
const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()
const participantId = route.params.id as string
const editData = ref<Record<string, any>>({})
const isSaving = ref(false)
const saveMessage = ref('')
const qrCodeUrl = ref<string | null>(null)

const participant = computed(() => checkin.current)
const fields = computed(() => config.fields)
const allDocs = computed(() => config.requiredDocuments)
const signatures = computed(() => (participant.value as any)?.signatures || [])
const signedDocIds = computed(() => signatures.value.map((s: any) => s.documentDefId))
const signedCount = computed(() => signedDocIds.value.length)
const totalDocs = computed(() => allDocs.value.length)
const allSigned = computed(() => totalDocs.value > 0 && signedCount.value >= totalDocs.value)
const signProgress = computed(() => totalDocs.value > 0 ? Math.round((signedCount.value / totalDocs.value) * 100) : 0)

const participantName = computed(() => {
  if (!editData.value) return ''
  return `${editData.value['prenom'] || ''} ${(editData.value['nom'] || '').toUpperCase()}`.trim()
})

function statusSeverity(s: string) { return s === 'ABSENT' ? 'secondary' : s === 'PRESENT' ? 'info' : 'success' }
function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Signe' }

async function save() {
  isSaving.value = true; saveMessage.value = ''
  try {
    await checkin.updateParticipant(participantId, editData.value)
    await checkin.loadParticipant(participantId)
    if (participant.value?.data) editData.value = { ...(participant.value.data as Record<string, any>) }
    saveMessage.value = 'Sauvegarde'
    setTimeout(() => { saveMessage.value = '' }, 2000)
  } catch { saveMessage.value = 'Erreur' }
  finally { isSaving.value = false }
}

async function downloadPdf(docId: string) {
  try {
    const res = await api.get(`/events/${config.slug}/participants/${participantId}/pdf/${docId}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank')
  } catch { saveMessage.value = 'Erreur de telechargement' }
}

async function changeStatus(status: string) {
  try {
    await api.post(`/events/${config.slug}/participants/${participantId}/status`, { status })
    await checkin.loadParticipant(participantId)
    saveMessage.value = status === 'PRESENT' ? 'Marque present' : 'Marque absent'
    setTimeout(() => { saveMessage.value = '' }, 2000)
  } catch { saveMessage.value = 'Erreur' }
}

async function sendEmail() {
  try { await checkin.sendEmail(participantId); saveMessage.value = 'Email envoye'; setTimeout(() => { saveMessage.value = '' }, 3000) }
  catch { saveMessage.value = "Erreur d'envoi" }
}

onMounted(async () => {
  if (!participant.value || participant.value.id !== participantId) await checkin.loadParticipant(participantId)
  if (participant.value?.data) editData.value = { ...(participant.value.data as Record<string, any>) }
  if (!config.config) await config.loadConfig()
  try {
    const res = await api.get(`/events/${config.slug}/participants/${participantId}/qrcode`, { responseType: 'blob' })
    qrCodeUrl.value = URL.createObjectURL(res.data)
  } catch {}
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b sticky top-0 z-20">
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <button class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200" @click="router.push('/scanner')">
          <i class="pi pi-arrow-left text-gray-600"></i>
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-base font-bold truncate">{{ participantName || 'Participant' }}</h1>
          <p v-if="participant" class="text-xs text-gray-400">{{ (participant as any).qrCode }}</p>
        </div>
        <Tag v-if="participant" :value="statusLabel(participant.status)" :severity="statusSeverity(participant.status)" />
      </div>
    </header>

    <div v-if="checkin.isLoading" class="text-center py-12 text-gray-500">
      <i class="pi pi-spin pi-spinner text-2xl"></i>
    </div>

    <div v-else-if="participant" class="max-w-2xl mx-auto px-3 py-4 space-y-3">
      <!-- Status + Sign CTA -->
      <div class="bg-white rounded-xl shadow-sm p-4">
        <div class="flex items-center gap-3 mb-3">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR" class="w-16 h-16 rounded border border-gray-200" />
          <div class="flex-1">
            <!-- Status toggle -->
            <div class="flex gap-2">
              <button v-if="participant.status === 'ABSENT'"
                class="px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5"
                style="background-color: #16a34a; color: white;"
                @click="changeStatus('PRESENT')"
              ><i class="pi pi-check text-xs"></i> Present</button>
              <button v-if="participant.status === 'PRESENT' && !allSigned"
                class="px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5"
                style="background-color: #f3f4f6; color: #4b5563;"
                @click="changeStatus('ABSENT')"
              ><i class="pi pi-times text-xs"></i> Absent</button>
            </div>
          </div>
        </div>

        <!-- Signing progress -->
        <div v-if="totalDocs > 0">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-gray-500">Documents signes</span>
            <span class="font-semibold">{{ signedCount }} / {{ totalDocs }}</span>
          </div>
          <ProgressBar :value="signProgress" :showValue="false" class="h-2 mb-3" />

          <!-- Signed docs -->
          <div v-for="sig in signatures" :key="sig.id" class="flex items-center justify-between p-2.5 bg-green-50 rounded-lg border border-green-200 mb-1.5">
            <div class="flex items-center gap-2 min-w-0">
              <i class="pi pi-check-circle text-green-600 shrink-0"></i>
              <span class="text-sm font-medium truncate">{{ sig.documentDef?.title }}</span>
            </div>
            <button class="text-blue-600 p-1.5 shrink-0" @click="downloadPdf(sig.documentDefId)">
              <i class="pi pi-download"></i>
            </button>
          </div>

          <!-- Unsigned docs -->
          <div v-for="doc in allDocs.filter(d => !signedDocIds.includes(d.id))" :key="doc.id"
            class="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 mb-1.5">
            <i class="pi pi-circle text-gray-300 shrink-0"></i>
            <span class="text-sm text-gray-500 truncate">{{ doc.title }}</span>
            <Tag v-if="doc.required" value="requis" severity="warn" class="text-[10px] ml-auto shrink-0" />
          </div>

          <!-- Sign button -->
          <button v-if="!allSigned"
            class="w-full mt-3 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 shadow-md"
            style="background-color: #2563eb; color: white;"
            @click="router.push(`/signature/${participantId}`)"
          >
            <i class="pi pi-pencil"></i>
            {{ allDocs.find(d => !signedDocIds.includes(d.id))?.signingLabel || 'Signer' }}
            <span style="background-color: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 4px;">{{ totalDocs - signedCount }} restant{{ totalDocs - signedCount > 1 ? 's' : '' }}</span>
          </button>

          <!-- Email button -->
          <button v-if="allSigned && config.config?.email?.allowManualSend"
            class="w-full mt-3 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm active:bg-gray-200 flex items-center justify-center gap-2"
            @click="sendEmail"
          >
            <i class="pi pi-envelope"></i> Envoyer par e-mail
          </button>
        </div>
      </div>

      <!-- Editable fields -->
      <div class="bg-white rounded-xl shadow-sm p-4">
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Informations</h3>
        <div class="space-y-3">
          <div v-for="field in fields" :key="field.key">
            <label class="text-xs font-medium text-gray-500 mb-1 block">{{ field.label }}</label>
            <template v-if="field.editable">
              <select v-if="field.type === 'select'" v-model="editData[field.key]" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm">
                <option value="">—</option>
                <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <textarea v-else-if="field.type === 'textarea'" v-model="editData[field.key]" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
              <InputText v-else v-model="editData[field.key]" :type="field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'" class="w-full" />
            </template>
            <div v-else class="text-gray-800 text-sm py-1 px-1">{{ editData[field.key] || '—' }}</div>
          </div>
        </div>

        <button
          class="w-full mt-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style="background-color: #1f2937; color: white;"
          :disabled="isSaving"
          @click="save"
        >
          <i :class="isSaving ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i>
          Sauvegarder
        </button>
      </div>

      <!-- Save feedback -->
      <div v-if="saveMessage" class="p-3 rounded-lg text-sm text-center"
        :class="saveMessage.includes('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'"
      >{{ saveMessage }}</div>
    </div>
  </div>
</template>
