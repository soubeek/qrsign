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

function statusSeverity(s: string) { return s === 'ABSENT' ? 'secondary' : s === 'PRESENT' ? 'info' : 'success' }
function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Present + Signe' }

async function save() {
  isSaving.value = true; saveMessage.value = ''
  try {
    const result = await checkin.updateParticipant(participantId, editData.value)
    if (result?.data) editData.value = { ...(result.data as Record<string, any>) }
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

async function sendEmail() {
  try { await checkin.sendEmail(participantId); saveMessage.value = 'Email envoye'; setTimeout(() => { saveMessage.value = '' }, 3000) }
  catch { saveMessage.value = "Erreur d'envoi" }
}

onMounted(async () => {
  if (!participant.value || participant.value.id !== participantId) await checkin.loadParticipant(participantId)
  if (participant.value?.data) editData.value = { ...(participant.value.data as Record<string, any>) }
  if (!config.config) await config.loadConfig()
  // Load QR code image
  try {
    const res = await api.get(`/events/${config.slug}/participants/${participantId}/qrcode`, { responseType: 'blob' })
    qrCodeUrl.value = URL.createObjectURL(res.data)
  } catch {}
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center gap-3 mb-4">
        <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push('/scanner')" />
        <h1 class="text-xl font-bold">Fiche {{ config.config?.app?.entitySingular }}</h1>
      </div>

      <div v-if="checkin.isLoading" class="text-center py-12 text-gray-500">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
      </div>

      <div v-else-if="participant" class="space-y-4">
        <!-- Header card -->
        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center gap-4 mb-4">
            <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="w-20 h-20 rounded border border-gray-200" />
            <div class="flex-1">
              <h2 class="text-lg font-semibold">{{ editData['prenom'] }} {{ editData['nom'] }}</h2>
              <p class="text-gray-500 text-sm">{{ (participant as any).qrCode }}</p>
            </div>
            <Tag :value="statusLabel(participant.status)" :severity="statusSeverity(participant.status)" />
          </div>

          <!-- Signing progress -->
          <div v-if="totalDocs > 0" class="mb-4">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600">Documents signes</span>
              <span class="font-medium">{{ signedCount }} / {{ totalDocs }}</span>
            </div>
            <ProgressBar :value="signProgress" :showValue="false" class="h-2" />
          </div>

          <!-- Signed documents list -->
          <div v-if="signatures.length > 0" class="space-y-2 mb-4">
            <div v-for="sig in signatures" :key="sig.id" class="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
              <div class="flex items-center gap-2">
                <i class="pi pi-check-circle text-green-600"></i>
                <span class="text-sm font-medium">{{ sig.documentDef?.title }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{{ new Date(sig.signedAt).toLocaleDateString('fr-FR') }}</span>
                <Button icon="pi pi-download" severity="info" text size="small" @click="downloadPdf(sig.documentDefId)" />
              </div>
            </div>
          </div>

          <!-- Unsigned documents -->
          <div v-if="!allSigned && totalDocs > 0" class="space-y-2 mb-4">
            <div v-for="doc in allDocs.filter(d => !signedDocIds.includes(d.id))" :key="doc.id" class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <i class="pi pi-circle text-gray-300"></i>
              <span class="text-sm text-gray-500">{{ doc.title }}</span>
              <Tag v-if="doc.required" value="requis" severity="warn" class="text-xs ml-auto" />
            </div>
          </div>
        </div>

        <!-- Fields -->
        <div class="bg-white rounded-xl shadow p-6">
          <div class="space-y-4">
            <div v-for="field in fields" :key="field.key" class="grid grid-cols-3 gap-2 items-start">
              <label class="text-sm font-medium text-gray-600 pt-2">{{ field.label }}</label>
              <div class="col-span-2">
                <template v-if="field.editable && !allSigned">
                  <select v-if="field.type === 'select'" v-model="editData[field.key]" class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">—</option>
                    <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <textarea v-else-if="field.type === 'textarea'" v-model="editData[field.key]" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  <InputText v-else v-model="editData[field.key]" :type="field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'" class="w-full" />
                </template>
                <span v-else class="text-gray-800 block py-1">{{ editData[field.key] || '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-3">
          <Button v-if="!allSigned" label="Sauvegarder" icon="pi pi-check" :loading="isSaving" @click="save" />
          <Button v-if="!allSigned" :label="`${allDocs.find(d => !signedDocIds.includes(d.id))?.signingLabel || 'Signer'} (${totalDocs - signedCount} restant${totalDocs - signedCount > 1 ? 's' : ''})`" icon="pi pi-pencil" severity="success" size="large" @click="router.push(`/signature/${participantId}`)" />
          <Button v-if="allSigned && config.config?.email?.allowManualSend" label="Envoyer par e-mail" icon="pi pi-envelope" severity="secondary" @click="sendEmail" />
        </div>

        <div v-if="saveMessage" class="p-2 rounded text-sm" :class="saveMessage.includes('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'">{{ saveMessage }}</div>
      </div>
    </div>
  </div>
</template>
