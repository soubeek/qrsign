<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import { Html5Qrcode } from 'html5-qrcode'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()

const scannerRef = ref<Html5Qrcode | null>(null)
const scannerRunning = ref(false)
const cameraAvailable = ref(true)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const isProcessing = ref(false) // anti-double-scan lock
const errorBanner = ref<{ type: string; message: string; link?: string } | null>(null)
const barcodeBuffer = ref('')
const barcodeTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const hiddenInput = ref<HTMLInputElement | null>(null)
let searchDebounce: ReturnType<typeof setTimeout> | null = null
let autoSelectTimeout: ReturnType<typeof setTimeout> | null = null
let lastScannedCode = ''
let lastScanTime = 0

// Audio context for beep sounds
let audioCtx: AudioContext | null = null
function playBeep(frequency: number, duration: number) {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    oscillator.connect(gain)
    gain.connect(audioCtx.destination)
    oscillator.frequency.value = frequency
    gain.gain.value = 0.3
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + duration / 1000)
  } catch {}
}

function playSuccess() {
  playBeep(880, 150)
  setTimeout(() => playBeep(1100, 200), 160)
}

function playError() {
  playBeep(300, 300)
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch {}
}

function refocus() {
  if (hiddenInput.value) hiddenInput.value.focus()
}

async function stopScanner() {
  if (scannerRunning.value && scannerRef.value) {
    try { await scannerRef.value.stop(); scannerRunning.value = false } catch {}
  }
}

async function handleScan(qrCode: string) {
  // Anti-double-scan: ignore same code within 2 seconds
  const now = Date.now()
  if (qrCode === lastScannedCode && now - lastScanTime < 2000) return
  if (isProcessing.value) return
  lastScannedCode = qrCode
  lastScanTime = now
  isProcessing.value = true
  errorBanner.value = null

  try {
    const result = await checkin.scan(qrCode)
    if (result.participant.status === 'SIGNED') {
      playBeep(600, 200) // amber tone
      vibrate([100, 50, 100])
      errorBanner.value = {
        type: 'warn',
        message: `Document deja signe le ${new Date(result.participant.signedAt!).toLocaleDateString('fr-FR')}`,
        link: `/participant/${result.participant.id}`,
      }
      isProcessing.value = false
      refocus()
      return
    }
    playSuccess()
    vibrate(200)
    await stopScanner()
    router.push(`/participant/${result.participant.id}`)
  } catch (err: any) {
    if (err?.response?.status === 404) {
      playError()
      vibrate([100, 50, 100, 50, 100])
      errorBanner.value = { type: 'error', message: 'Badge non reconnu — Essayez la recherche manuelle' }
    } else {
      playError()
      errorBanner.value = { type: 'info', message: 'Hors ligne — reessayez' }
    }
    refocus()
  } finally {
    // Release lock after a short delay to prevent rapid re-scans
    setTimeout(() => { isProcessing.value = false }, 500)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== hiddenInput.value) return
  if (e.key === 'Enter' && barcodeBuffer.value.length > 2) {
    handleScan(barcodeBuffer.value.trim())
    barcodeBuffer.value = ''
    return
  }
  if (e.key.length === 1) {
    barcodeBuffer.value += e.key
    if (barcodeTimeout.value) clearTimeout(barcodeTimeout.value)
    barcodeTimeout.value = setTimeout(() => { barcodeBuffer.value = '' }, 200)
  }
}

async function onSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) { searchResults.value = []; return }
  isSearching.value = true
  try {
    const result = await checkin.searchParticipants(q, 8)
    searchResults.value = result.participants || []
    if (searchResults.value.length === 1) {
      autoSelectTimeout = setTimeout(() => selectParticipant(searchResults.value[0]), 600)
    }
  } catch { searchResults.value = [] }
  finally { isSearching.value = false }
}

function onSearchInput() {
  if (autoSelectTimeout) clearTimeout(autoSelectTimeout)
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(onSearch, 300)
}

async function selectParticipant(p: any) {
  if (isProcessing.value) return
  isProcessing.value = true
  errorBanner.value = null
  try {
    // Mark as PRESENT if ABSENT
    if (p.status === 'ABSENT') {
      await checkin.markPresent(p.id)
    }
    await checkin.loadParticipant(p.id)
    playSuccess()
    vibrate(200)
    await stopScanner()
    router.push(`/participant/${p.id}`)
  } catch {
    playError()
    errorBanner.value = { type: 'info', message: 'Erreur de chargement' }
    refocus()
  } finally {
    setTimeout(() => { isProcessing.value = false }, 500)
  }
}

function getInitials(data: Record<string, any>): string {
  return ((data['prenom'] || '').charAt(0) + (data['nom'] || '').charAt(0)).toUpperCase() || '??'
}

function getDisplayName(data: Record<string, any>): string {
  return `${data['civilite'] || ''} ${(data['nom'] || '').toUpperCase()} ${data['prenom'] || ''}`.trim()
}

function statusSeverity(status: string) {
  return status === 'ABSENT' ? 'secondary' : status === 'PRESENT' ? 'info' : 'success'
}

function statusLabel(status: string) {
  return status === 'ABSENT' ? 'Absent' : status === 'PRESENT' ? 'Present' : 'Signe'
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  try {
    scannerRef.value = new Html5Qrcode('qr-reader')
    await scannerRef.value.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
      (text) => handleScan(text), () => {})
    scannerRunning.value = true
  } catch { cameraAvailable.value = false }
  refocus()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (searchDebounce) clearTimeout(searchDebounce)
  if (autoSelectTimeout) clearTimeout(autoSelectTimeout)
  if (scannerRunning.value && scannerRef.value) {
    scannerRef.value.stop().catch(() => {})
    scannerRunning.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">{{ config.config?.app?.emoji }} {{ config.config?.app?.title }}</h1>

      <!-- Processing indicator -->
      <div v-if="isProcessing" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
        <i class="pi pi-spin pi-spinner"></i> Traitement en cours...
      </div>

      <!-- Error banner -->
      <div v-if="errorBanner && !isProcessing" class="mb-4 p-4 rounded-lg flex items-center justify-between" :class="{
        'bg-red-100 text-red-800 border border-red-300': errorBanner.type === 'error',
        'bg-amber-100 text-amber-800 border border-amber-300': errorBanner.type === 'warn',
        'bg-gray-100 text-gray-700 border border-gray-300': errorBanner.type === 'info',
      }">
        <span>
          {{ errorBanner.message }}
          <router-link v-if="errorBanner.link" :to="errorBanner.link" class="underline ml-2">Voir la fiche</router-link>
        </span>
        <button class="ml-4 text-sm underline shrink-0" @click="errorBanner = null; refocus()">Fermer</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left: QR Scanner -->
        <div class="bg-white rounded-xl shadow p-4">
          <h2 class="text-lg font-semibold mb-3">Scanner un badge</h2>
          <div v-if="cameraAvailable" id="qr-reader" class="w-full"></div>
          <p v-else class="text-gray-500 py-8 text-center">Camera non disponible.<br>Utilisez un lecteur USB ou la recherche.</p>
          <input ref="hiddenInput" class="opacity-0 absolute -z-10" tabindex="-1" aria-hidden="true" />
        </div>

        <!-- Right: Search -->
        <div class="bg-white rounded-xl shadow p-4">
          <h2 class="text-lg font-semibold mb-3">Recherche par nom</h2>
          <InputText v-model="searchQuery" placeholder="Nom ou prenom..." class="w-full mb-3" @input="onSearchInput" />
          <div v-if="isSearching" class="text-gray-500 text-sm py-2 flex items-center gap-2">
            <i class="pi pi-spin pi-spinner"></i> Recherche...
          </div>
          <div v-if="searchResults.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
            <div v-for="p in searchResults" :key="p.id"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border border-gray-100 active:bg-blue-100 transition-colors"
              @click="selectParticipant(p)"
            >
              <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {{ getInitials(p.data) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ getDisplayName(p.data) }}</div>
                <div class="text-sm text-gray-500">{{ p.data.commune || '' }}</div>
              </div>
              <Tag :value="statusLabel(p.status)" :severity="statusSeverity(p.status)" />
            </div>
          </div>
          <div v-if="searchQuery.length >= 2 && !isSearching && searchResults.length === 0" class="text-gray-500 text-sm mt-2">
            Aucun resultat
          </div>
        </div>
      </div>

      <div class="mt-6">
        <Button label="Tableau de bord" icon="pi pi-chart-bar" severity="secondary" @click="router.push('/')" />
      </div>
    </div>
  </div>
</template>
