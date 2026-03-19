<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import { useSignaturePad } from '../composables/useSignaturePad'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

const route = useRoute()
const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()
const participantId = route.params.id as string

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { isEmpty, clear, toDataURL, resizeCanvas } = useSignaturePad(canvasRef)
const isSigning = ref(false)
const errorMsg = ref('')
const showConfirm = ref(false)
const currentDocIndex = ref(0)

const participant = computed(() => checkin.current)
const allDocs = computed(() => config.requiredDocuments)
const signedDocIds = computed(() => {
  const sigs = (participant.value as any)?.signatures || []
  return sigs.map((s: any) => s.documentDefId)
})
const unsignedDocs = computed(() => allDocs.value.filter(d => !signedDocIds.value.includes(d.id)))
const currentDoc = computed(() => unsignedDocs.value[currentDocIndex.value] || null)
const totalDocs = computed(() => allDocs.value.length)
const signedCount = computed(() => totalDocs.value - unsignedDocs.value.length)
const progress = computed(() => totalDocs.value > 0 ? Math.round((signedCount.value / totalDocs.value) * 100) : 0)

const participantName = computed(() => {
  if (!participant.value?.data) return ''
  const d = (participant.value.data || {}) as Record<string, any>
  return `${d['prenom'] || ''} ${d['nom'] || ''}`.trim()
})

const noticeSections = computed(() => {
  if (!currentDoc.value?.noticeSections) return []
  const ns = currentDoc.value.noticeSections
  return Array.isArray(ns) ? ns : JSON.parse(ns as any || '[]')
})

const declarationText = computed(() => {
  if (!currentDoc.value?.declarationTemplate || !participant.value?.data) return ''
  let text = currentDoc.value.declarationTemplate
  const data = (participant.value.data || {}) as Record<string, any>
  for (const [key, value] of Object.entries(data)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''))
  }
  text = text.replace('{signedAt}', new Date().toLocaleDateString('fr-FR') + ' a ' + new Date().toLocaleTimeString('fr-FR'))
  return text
})

function requestValidation() {
  if (isEmpty.value) { errorMsg.value = 'Veuillez signer avant de valider'; return }
  errorMsg.value = ''
  showConfirm.value = true
}

async function confirmAndSign() {
  showConfirm.value = false
  if (!currentDoc.value) return
  isSigning.value = true
  errorMsg.value = ''
  try {
    const result = await checkin.sign(participantId, currentDoc.value.id, toDataURL())
    // Reload participant to get updated signatures
    await checkin.loadParticipant(participantId)

    if (result.allSigned) {
      // All required documents signed → confirmation
      router.push(`/confirmation/${participantId}`)
    } else {
      // More documents to sign — reset pad and show next
      currentDocIndex.value = 0
      clear()
      await nextTick()
      resizeCanvas()
    }
  } catch {
    errorMsg.value = 'Erreur lors de la signature. Veuillez reessayer.'
  } finally {
    isSigning.value = false
  }
}

onMounted(async () => {
  if (!participant.value || participant.value.id !== participantId) {
    await checkin.loadParticipant(participantId)
  }
  if (!config.config) await config.loadConfig()
  // If all docs already signed, go to confirmation
  if (unsignedDocs.value.length === 0 && allDocs.value.length > 0) {
    router.push(`/confirmation/${participantId}`)
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header (fixed) -->
    <div class="bg-white shadow-sm border-b p-4 sticky top-0 z-10">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-2">
          <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push(`/participant/${participantId}`)" />
          <div class="flex-1">
            <h1 class="text-lg font-bold">{{ currentDoc?.title || 'Signature' }}</h1>
            <p v-if="participantName" class="text-sm text-gray-500">{{ participantName }}</p>
          </div>
          <div class="text-right text-sm text-gray-500">
            Document {{ signedCount + 1 }} / {{ totalDocs }}
          </div>
        </div>
        <ProgressBar :value="progress" :showValue="false" class="h-2" />
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="!currentDoc" class="max-w-3xl mx-auto p-4 text-center py-12 text-gray-500">
        <i class="pi pi-check-circle text-4xl text-green-500 mb-3"></i>
        <p>Tous les documents ont ete signes.</p>
        <Button label="Voir la confirmation" class="mt-4" @click="router.push(`/confirmation/${participantId}`)" />
      </div>

      <div v-else class="max-w-3xl mx-auto p-4 space-y-4">
        <!-- Notice sections -->
        <div v-if="noticeSections.length > 0" class="bg-white rounded-xl shadow p-6 space-y-5">
          <div v-for="(section, i) in noticeSections" :key="i">
            <h3 class="font-semibold text-sm mb-2">{{ section.title }}</h3>
            <p class="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{{ section.content }}</p>
          </div>
        </div>

        <!-- Declaration -->
        <div class="bg-blue-50 rounded-xl shadow p-6 border border-blue-200">
          <h3 class="font-semibold text-sm mb-3 text-blue-800">Declaration</h3>
          <p class="text-sm whitespace-pre-line leading-relaxed">{{ declarationText }}</p>
        </div>

        <!-- Signature pad -->
        <div class="bg-white rounded-xl shadow p-6">
          <h3 class="font-semibold text-sm mb-3">{{ currentDoc?.signingLabel || 'Signer le document' }}</h3>
          <div class="border-2 border-dashed border-gray-300 rounded-lg bg-white relative" style="touch-action: none;">
            <canvas ref="canvasRef" class="w-full" style="height: 200px; display: block;" />
            <div v-if="isEmpty" class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-gray-300 text-sm">Signez ici</span>
            </div>
          </div>
          <div v-if="errorMsg" class="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">{{ errorMsg }}</div>
          <div class="mt-4 flex gap-3">
            <Button label="Effacer" icon="pi pi-trash" severity="secondary" outlined @click="clear" />
            <Button :label="unsignedDocs.length > 1 ? 'Signer et passer au suivant' : 'Signer et terminer'"
              icon="pi pi-check" severity="success" size="large"
              :loading="isSigning" :disabled="isEmpty" @click="requestValidation" class="flex-1" />
          </div>
        </div>
        <div class="h-4"></div>
      </div>
    </div>

    <!-- Confirmation dialog -->
    <Dialog v-model:visible="showConfirm" header="Confirmer la signature" modal class="w-full max-w-md">
      <div class="p-2">
        <p class="mb-2">Vous signez :</p>
        <p class="font-semibold text-lg mb-3">{{ currentDoc?.title }}</p>
        <p class="text-sm text-gray-500">en tant que <strong>{{ participantName }}</strong></p>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showConfirm = false" />
        <Button label="Confirmer" icon="pi pi-check" severity="success" :loading="isSigning" @click="confirmAndSign" />
      </template>
    </Dialog>
  </div>
</template>
