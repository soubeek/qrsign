<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import InputText from 'primevue/inputtext'
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
const activeTab = ref('documents')

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

function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Signe' }
function statusColor(s: string) { return s === 'ABSENT' ? '#ef4444' : s === 'PRESENT' ? '#f59e0b' : '#22c55e' }

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
  // Default to documents tab if there are unsigned docs, otherwise infos
  if (totalDocs.value === 0 || allSigned.value) activeTab.value = 'infos'
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
        <button class="w-9 h-9 rounded-lg flex items-center justify-center" style="background-color: #f3f4f6;" @click="router.push('/scanner')">
          <i class="pi pi-arrow-left text-gray-600"></i>
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-base font-bold truncate">{{ participantName || 'Participant' }}</h1>
          <div class="flex items-center gap-2">
            <span v-if="participant" class="text-xs" :style="{ color: statusColor(participant.status) }">{{ statusLabel(participant.status) }}</span>
          </div>
        </div>
        <!-- Status toggle — right aligned -->
        <button v-if="participant?.status === 'ABSENT'"
          class="px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 shrink-0"
          style="background-color: #16a34a; color: white;"
          @click="changeStatus('PRESENT')"
        ><i class="pi pi-check text-xs"></i> Present</button>
        <button v-else-if="participant?.status === 'PRESENT' && !allSigned"
          class="px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 shrink-0"
          style="background-color: #f3f4f6; color: #4b5563;"
          @click="changeStatus('ABSENT')"
        ><i class="pi pi-times text-xs"></i> Absent</button>
        <Tag v-else-if="participant?.status === 'SIGNED'" value="Signe" severity="success" class="shrink-0" />
      </div>
    </header>

    <div v-if="checkin.isLoading" class="text-center py-12 text-gray-500">
      <i class="pi pi-spin pi-spinner text-2xl"></i>
    </div>

    <div v-else-if="participant" class="max-w-2xl mx-auto">
      <!-- Tabs -->
      <div class="flex border-b bg-white sticky top-[57px] z-10">
        <button
          class="flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors"
          :style="activeTab === 'documents' ? 'border-color: #2563eb; color: #2563eb;' : 'border-color: transparent; color: #9ca3af;'"
          @click="activeTab = 'documents'"
        >
          <i class="pi pi-file-edit mr-1.5"></i>
          Documents
          <span v-if="totalDocs > 0 && !allSigned"
            class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style="background-color: #2563eb; color: white;"
          >{{ totalDocs - signedCount }}</span>
        </button>
        <button
          class="flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors"
          :style="activeTab === 'infos' ? 'border-color: #2563eb; color: #2563eb;' : 'border-color: transparent; color: #9ca3af;'"
          @click="activeTab = 'infos'"
        >
          <i class="pi pi-user mr-1.5"></i>
          Informations
        </button>
      </div>

      <!-- Tab: Documents -->
      <div v-if="activeTab === 'documents'" class="px-3 py-4 space-y-3">
        <div v-if="totalDocs === 0" class="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          <i class="pi pi-file text-3xl mb-3"></i>
          <p>Aucun document a signer pour cet evenement.</p>
        </div>

        <template v-else>
          <!-- Progress -->
          <div class="bg-white rounded-xl shadow-sm p-4">
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-gray-500">Progression</span>
              <span class="font-semibold">{{ signedCount }} / {{ totalDocs }}</span>
            </div>
            <ProgressBar :value="signProgress" :showValue="false" class="h-2" />
          </div>

          <!-- Signed docs -->
          <div v-for="sig in signatures" :key="sig.id" class="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border-l-4" style="border-color: #22c55e;">
            <div class="flex items-center gap-2.5 min-w-0">
              <i class="pi pi-check-circle shrink-0" style="color: #22c55e;"></i>
              <div class="min-w-0">
                <div class="text-sm font-medium truncate">{{ sig.documentDef?.title }}</div>
                <div class="text-[10px] text-gray-400">{{ new Date(sig.signedAt).toLocaleDateString('fr-FR') }}</div>
              </div>
            </div>
            <button class="p-2 shrink-0" style="color: #2563eb;" @click="downloadPdf(sig.documentDefId)">
              <i class="pi pi-download"></i>
            </button>
          </div>

          <!-- Unsigned docs -->
          <div v-for="doc in allDocs.filter(d => !signedDocIds.includes(d.id))" :key="doc.id"
            class="flex items-center gap-2.5 p-3 bg-white rounded-xl shadow-sm border-l-4 border-gray-300">
            <i class="pi pi-circle text-gray-300 shrink-0"></i>
            <span class="text-sm text-gray-500 truncate flex-1">{{ doc.title }}</span>
            <Tag v-if="doc.required" value="requis" severity="warn" class="text-[10px] shrink-0" />
          </div>

          <!-- Sign CTA -->
          <button v-if="!allSigned"
            class="w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 shadow-lg"
            style="background-color: #2563eb; color: white;"
            @click="router.push(`/signature/${participantId}`)"
          >
            <i class="pi pi-pencil"></i>
            {{ allDocs.find(d => !signedDocIds.includes(d.id))?.signingLabel || 'Signer' }}
            <span style="background-color: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 4px;">{{ totalDocs - signedCount }}</span>
          </button>

          <!-- Email -->
          <button v-if="allSigned && config.config?.email?.allowManualSend"
            class="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            style="background-color: #f3f4f6; color: #374151;"
            @click="sendEmail"
          >
            <i class="pi pi-envelope"></i> Envoyer par e-mail
          </button>
        </template>
      </div>

      <!-- Tab: Informations -->
      <div v-if="activeTab === 'infos'" class="px-3 py-4 space-y-3">
        <!-- QR Code -->
        <div v-if="qrCodeUrl" class="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
          <img :src="qrCodeUrl" alt="QR" class="w-20 h-20 rounded border border-gray-200" />
          <div>
            <div class="text-sm font-medium text-gray-800">{{ (participant as any).qrCode }}</div>
            <div class="text-xs text-gray-400 mt-1">Code QR du participant</div>
          </div>
        </div>

        <!-- Editable fields -->
        <div class="bg-white rounded-xl shadow-sm p-4">
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
      </div>

      <!-- Save feedback (visible on both tabs) -->
      <div v-if="saveMessage" class="mx-3 mb-3 p-3 rounded-lg text-sm text-center"
        :class="saveMessage.includes('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'"
      >{{ saveMessage }}</div>
    </div>
  </div>
</template>
