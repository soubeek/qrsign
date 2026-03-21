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
const textZoom = ref(100)
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

function replaceVars(text: string): string {
  if (!text || !participant.value?.data) return text
  const data = (participant.value.data || {}) as Record<string, any>
  for (const [key, value] of Object.entries(data)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''))
  }
  text = text.replace(/\{signedAt\}/g, new Date().toLocaleDateString('fr-FR') + ' a ' + new Date().toLocaleTimeString('fr-FR'))
  return text
}

const noticeSections = computed(() => {
  if (!currentDoc.value?.noticeSections) return []
  const ns = currentDoc.value.noticeSections
  const sections = Array.isArray(ns) ? ns : JSON.parse(ns as any || '[]')
  return sections.map((s: any) => ({ ...s, title: replaceVars(s.title), content: replaceVars(s.content) }))
})

const declarationText = computed(() => {
  if (!currentDoc.value?.declarationTemplate) return ''
  return replaceVars(currentDoc.value.declarationTemplate)
})

function formatContent(text: string, align?: string): string {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc list-inside my-1">$1</ul>')
  html = html.replace(/\n/g, '<br>')
  html = html.replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>')
  return html
}

function sectionStyle(section: any): string {
  const align = section.align || 'left'
  return `text-align: ${align};`
}

const declarationStyle = computed(() => {
  const align = currentDoc.value?.declarationAlign || 'left'
  return `text-align: ${align};`
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
    await checkin.loadParticipant(participantId)

    if (result.allSigned) {
      router.push(`/confirmation/${participantId}`)
    } else {
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
  if (unsignedDocs.value.length === 0 && allDocs.value.length > 0) {
    router.push(`/confirmation/${participantId}`)
  }
})
</script>

<template>
  <div class="app-fixed-layout bg-gray-50">
    <!-- Header — fixed top -->
    <div class="bg-white shadow-sm border-b p-3 z-10 shrink-0">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-2">
          <button class="w-9 h-9 rounded-lg flex items-center justify-center" style="background-color: #f3f4f6;" @click="router.push(`/participant/${participantId}`)">
            <i class="pi pi-arrow-left text-gray-600"></i>
          </button>
          <div class="flex-1 min-w-0">
            <h1 class="text-base font-bold truncate">{{ currentDoc?.title || 'Signature' }}</h1>
            <p v-if="participantName" class="text-xs text-gray-500">{{ participantName }}</p>
          </div>
          <div class="text-right text-xs text-gray-400">
            {{ signedCount + 1 }} / {{ totalDocs }}
          </div>
        </div>
        <ProgressBar :value="progress" :showValue="false" class="h-1.5" />
      </div>
    </div>

    <!-- Scrollable document content -->
    <div class="flex-1 overflow-auto" style="-webkit-overflow-scrolling: touch;">
      <div v-if="!currentDoc" class="max-w-3xl mx-auto p-4 text-center py-12 text-gray-500">
        <i class="pi pi-check-circle text-4xl text-green-500 mb-3"></i>
        <p>Tous les documents ont ete signes.</p>
        <Button label="Voir la confirmation" class="mt-4" @click="router.push(`/confirmation/${participantId}`)" />
      </div>

      <div v-else class="max-w-3xl mx-auto p-4 space-y-4">
        <!-- Zoom controls -->
        <div class="flex items-center justify-end gap-1">
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style="background-color: #e5e7eb; color: #374151;"
            :disabled="textZoom <= 80"
            :style="textZoom <= 80 ? 'opacity: 0.3;' : ''"
            @click="textZoom = Math.max(80, textZoom - 20)"
          >A-</button>
          <span class="text-xs text-gray-400 w-10 text-center">{{ textZoom }}%</span>
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style="background-color: #e5e7eb; color: #374151;"
            :disabled="textZoom >= 180"
            :style="textZoom >= 180 ? 'opacity: 0.3;' : ''"
            @click="textZoom = Math.min(180, textZoom + 20)"
          >A+</button>
        </div>

        <!-- Notice sections -->
        <div v-if="noticeSections.length > 0" class="bg-white rounded-xl shadow p-5 space-y-4" :style="{ fontSize: textZoom + '%' }">
          <div v-for="(section, i) in noticeSections" :key="i">
            <h3 class="font-semibold text-sm mb-1.5">{{ section.title }}</h3>
            <div class="text-sm text-gray-600 leading-relaxed" :style="sectionStyle(section)" v-html="formatContent(section.content, section.align)"></div>
          </div>
        </div>

        <!-- Declaration -->
        <div class="bg-blue-50 rounded-xl shadow p-5 border border-blue-200" :style="{ fontSize: textZoom + '%' }">
          <h3 class="font-semibold text-sm mb-2 text-blue-800">Declaration</h3>
          <div class="text-sm leading-relaxed" :style="declarationStyle" v-html="formatContent(declarationText)"></div>
        </div>
      </div>
    </div>

    <!-- Fixed bottom: Signature pad + actions -->
    <div v-if="currentDoc" class="shrink-0 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div class="max-w-3xl mx-auto p-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-xs text-gray-500 uppercase tracking-wide">{{ currentDoc?.signingLabel || 'Signature' }}</h3>
          <button class="text-xs text-gray-400 flex items-center gap-1" @click="clear">
            <i class="pi pi-trash text-[10px]"></i> Effacer
          </button>
        </div>
        <div class="border-2 border-dashed border-gray-300 rounded-lg bg-white relative" style="touch-action: none;">
          <canvas ref="canvasRef" class="w-full" style="height: 160px; display: block;" />
          <div v-if="isEmpty" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="text-gray-300 text-sm">Signez ici</span>
          </div>
        </div>
        <div v-if="errorMsg" class="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">{{ errorMsg }}</div>
        <button
          class="w-full mt-2 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          :style="isEmpty ? 'background-color: #e5e7eb; color: #9ca3af;' : 'background-color: #16a34a; color: white;'"
          :disabled="isSigning"
          @click="requestValidation"
        >
          <i :class="isSigning ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i>
          {{ unsignedDocs.length > 1 ? 'Signer et suivant' : 'Signer et terminer' }}
        </button>
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
