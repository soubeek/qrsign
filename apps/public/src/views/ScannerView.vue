<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import { useAuthStore } from '../stores/auth.store'
import { Html5Qrcode } from 'html5-qrcode'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()
const auth = useAuthStore()

const scannerRef = ref<Html5Qrcode | null>(null)
const scannerRunning = ref(false)
const cameraAvailable = ref(true)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const isProcessing = ref(false)
const errorBanner = ref<{ type: string; message: string; link?: string } | null>(null)
const lastScanResult = ref<{ name: string; time: string; status: string } | null>(null)
const barcodeBuffer = ref('')
const barcodeTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const hiddenInput = ref<HTMLInputElement | null>(null)
const clock = ref(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
const stats = ref<{ total: number; present: number; signed: number } | null>(null)
let searchDebounce: ReturnType<typeof setTimeout> | null = null
let autoSelectTimeout: ReturnType<typeof setTimeout> | null = null
let lastScannedCode = ''
let lastScanTime = 0
let clockInterval: ReturnType<typeof setInterval> | null = null
let statsInterval: ReturnType<typeof setInterval> | null = null

// Audio
let audioCtx: AudioContext | null = null
function playBeep(f: number, d: number) {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain()
    o.connect(g); g.connect(audioCtx.destination); o.frequency.value = f; g.gain.value = 0.3
    o.start(); o.stop(audioCtx.currentTime + d / 1000)
  } catch {}
}
function playSuccess() { playBeep(880, 150); setTimeout(() => playBeep(1100, 200), 160) }
function playError() { playBeep(300, 300) }
function vibrate(p: number | number[]) { try { navigator.vibrate?.(p) } catch {} }
function refocus() { if (hiddenInput.value) hiddenInput.value.focus() }

async function stopScanner() {
  if (scannerRunning.value && scannerRef.value) {
    try { await scannerRef.value.stop(); scannerRunning.value = false } catch {}
  }
}

async function loadStats() {
  try {
    const s = await checkin.getStats()
    stats.value = s
  } catch {}
}

async function handleScan(qrCode: string) {
  const now = Date.now()
  if (qrCode === lastScannedCode && now - lastScanTime < 2000) return
  if (isProcessing.value) return
  lastScannedCode = qrCode; lastScanTime = now
  isProcessing.value = true; errorBanner.value = null

  try {
    const result = await checkin.scan(qrCode)
    const data = result.participant?.data as Record<string, any> || {}
    const name = `${data['prenom'] || ''} ${(data['nom'] || '').toUpperCase()}`.trim()

    if (result.participant.status === 'SIGNED') {
      playBeep(600, 200); vibrate([100, 50, 100])
      lastScanResult.value = { name, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'SIGNED' }
      errorBanner.value = { type: 'warn', message: `${name} — documents deja signes`, link: `/participant/${result.participant.id}` }
      isProcessing.value = false; refocus(); loadStats(); return
    }
    playSuccess(); vibrate(200)
    lastScanResult.value = { name, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'PRESENT' }
    await stopScanner()
    loadStats()
    router.push(`/participant/${result.participant.id}`)
  } catch (err: any) {
    if (err?.response?.status === 404) {
      playError(); vibrate([100, 50, 100, 50, 100])
      errorBanner.value = { type: 'error', message: 'Badge non reconnu' }
    } else {
      playError(); errorBanner.value = { type: 'info', message: 'Hors ligne — reessayez' }
    }
    refocus()
  } finally {
    setTimeout(() => { isProcessing.value = false }, 500)
  }
}

function handleKeydown(e: KeyboardEvent) {
  // Escape: clear search
  if (e.key === 'Escape') { searchQuery.value = ''; searchResults.value = []; refocus(); return }
  if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== hiddenInput.value) return
  if (e.key === 'Enter' && barcodeBuffer.value.length > 2) {
    handleScan(barcodeBuffer.value.trim()); barcodeBuffer.value = ''; return
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
  isProcessing.value = true; errorBanner.value = null
  try {
    if (p.status === 'ABSENT') await checkin.markPresent(p.id)
    await checkin.loadParticipant(p.id)
    const data = p.data as Record<string, any>
    lastScanResult.value = { name: `${data['prenom'] || ''} ${(data['nom'] || '').toUpperCase()}`.trim(), time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'PRESENT' }
    playSuccess(); vibrate(200); await stopScanner(); loadStats()
    router.push(`/participant/${p.id}`)
  } catch { playError(); errorBanner.value = { type: 'info', message: 'Erreur de chargement' }; refocus() }
  finally { setTimeout(() => { isProcessing.value = false }, 500) }
}

function getInitials(data: Record<string, any>) {
  return ((data['prenom'] || '').charAt(0) + (data['nom'] || '').charAt(0)).toUpperCase() || '??'
}
function getDisplayName(data: Record<string, any>) {
  return `${data['civilite'] || ''} ${(data['nom'] || '').toUpperCase()} ${data['prenom'] || ''}`.trim()
}
function statusSeverity(s: string) { return s === 'ABSENT' ? 'secondary' : s === 'PRESENT' ? 'info' : 'success' }
function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Present + Signe' }

async function handleLogout() { await auth.logout(); router.push('/login') }

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  try {
    scannerRef.value = new Html5Qrcode('qr-reader')
    await scannerRef.value.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 280 } },
      (text) => handleScan(text), () => {})
    scannerRunning.value = true
  } catch { cameraAvailable.value = false }
  refocus()
  loadStats()
  clockInterval = setInterval(() => { clock.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }, 10000)
  statsInterval = setInterval(loadStats, 15000)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (searchDebounce) clearTimeout(searchDebounce)
  if (autoSelectTimeout) clearTimeout(autoSelectTimeout)
  if (clockInterval) clearInterval(clockInterval)
  if (statsInterval) clearInterval(statsInterval)
  if (scannerRunning.value && scannerRef.value) { scannerRef.value.stop().catch(() => {}); scannerRunning.value = false }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header bar -->
    <header class="bg-white shadow-sm border-b px-4 py-3">
      <div class="max-w-6xl mx-auto flex items-center gap-4">
        <div class="flex-1">
          <h1 class="text-xl font-bold">{{ config.config?.app?.emoji }} {{ config.config?.app?.title }}</h1>
          <p v-if="config.config?.app?.subtitle" class="text-xs text-gray-400">{{ config.config?.app?.subtitle }}</p>
        </div>

        <!-- Live stats -->
        <div v-if="stats" class="hidden sm:flex items-center gap-4 text-sm">
          <div class="text-center">
            <div class="text-lg font-bold text-blue-600">{{ stats.present }}</div>
            <div class="text-xs text-gray-400">Presents</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-green-600">{{ stats.signed }}</div>
            <div class="text-xs text-gray-400">Signes</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-400">{{ stats.total }}</div>
            <div class="text-xs text-gray-400">Total</div>
          </div>
        </div>

        <!-- Clock -->
        <div class="text-2xl font-mono text-gray-300 hidden md:block">{{ clock }}</div>

        <!-- Nav -->
        <div class="flex gap-1">
          <Button icon="pi pi-chart-bar" severity="secondary" text size="small" title="Tableau de bord" @click="router.push('/')" />
          <Button icon="pi pi-sign-out" severity="secondary" text size="small" title="Deconnexion" @click="handleLogout" />
        </div>
      </div>
    </header>

    <!-- Last scan result -->
    <div v-if="lastScanResult" class="px-4 py-2" :class="lastScanResult.status === 'SIGNED' ? 'bg-amber-50' : 'bg-green-50'">
      <div class="max-w-6xl mx-auto flex items-center gap-2 text-sm">
        <i :class="lastScanResult.status === 'SIGNED' ? 'pi pi-exclamation-circle text-amber-600' : 'pi pi-check-circle text-green-600'"></i>
        <span class="font-medium">{{ lastScanResult.name }}</span>
        <span class="text-gray-400">{{ lastScanResult.time }}</span>
        <Tag :value="lastScanResult.status === 'SIGNED' ? 'Deja signe' : 'Check-in OK'" :severity="lastScanResult.status === 'SIGNED' ? 'warn' : 'success'" class="text-xs ml-auto" />
      </div>
    </div>

    <!-- Processing / Error banners -->
    <div v-if="isProcessing" class="px-4 py-2 bg-blue-50 border-b border-blue-200">
      <div class="max-w-6xl mx-auto flex items-center gap-2 text-blue-700 text-sm">
        <i class="pi pi-spin pi-spinner"></i> Traitement en cours...
      </div>
    </div>
    <div v-if="errorBanner && !isProcessing" class="px-4 py-2 border-b" :class="{
      'bg-red-50 border-red-200 text-red-700': errorBanner.type === 'error',
      'bg-amber-50 border-amber-200 text-amber-700': errorBanner.type === 'warn',
      'bg-gray-50 border-gray-200 text-gray-600': errorBanner.type === 'info',
    }">
      <div class="max-w-6xl mx-auto flex items-center justify-between text-sm">
        <span>
          {{ errorBanner.message }}
          <router-link v-if="errorBanner.link" :to="errorBanner.link" class="underline ml-2">Voir la fiche</router-link>
        </span>
        <button class="text-xs underline" @click="errorBanner = null; refocus()">Fermer</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex-1 p-4">
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
        <!-- Left: QR Scanner (larger) -->
        <div class="lg:col-span-3 bg-white rounded-xl shadow flex flex-col">
          <div class="p-4 border-b flex items-center gap-2">
            <i class="pi pi-qrcode text-blue-600"></i>
            <h2 class="font-semibold">Scanner un badge</h2>
            <div v-if="scannerRunning" class="ml-auto flex items-center gap-1 text-xs text-green-600">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Camera active
            </div>
          </div>
          <div class="flex-1 p-4 flex items-center justify-center">
            <div v-if="cameraAvailable" id="qr-reader" class="w-full max-w-md"></div>
            <div v-else class="text-center text-gray-400 py-12">
              <i class="pi pi-video text-4xl mb-3"></i>
              <p>Camera non disponible</p>
              <p class="text-sm mt-1">Utilisez un lecteur USB ou la recherche</p>
            </div>
          </div>
          <input ref="hiddenInput" class="opacity-0 absolute -z-10" tabindex="-1" aria-hidden="true" />
        </div>

        <!-- Right: Search -->
        <div class="lg:col-span-2 bg-white rounded-xl shadow flex flex-col">
          <div class="p-4 border-b flex items-center gap-2">
            <i class="pi pi-search text-blue-600"></i>
            <h2 class="font-semibold">Recherche</h2>
          </div>
          <div class="p-4">
            <InputText v-model="searchQuery" placeholder="Nom ou prenom..." class="w-full" @input="onSearchInput" />
            <p class="text-xs text-gray-400 mt-1">Echap pour effacer</p>
          </div>
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <div v-if="isSearching" class="text-gray-400 text-sm py-4 flex items-center gap-2 justify-center">
              <i class="pi pi-spin pi-spinner"></i> Recherche...
            </div>
            <div v-else-if="searchResults.length > 0" class="space-y-2">
              <div v-for="p in searchResults" :key="p.id"
                class="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border border-gray-100 active:bg-blue-100 transition-colors"
                @click="selectParticipant(p)"
              >
                <div class="w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0"
                  :class="p.status === 'SIGNED' ? 'bg-green-500' : p.status === 'PRESENT' ? 'bg-blue-500' : 'bg-gray-400'"
                >
                  {{ getInitials(p.data) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ getDisplayName(p.data) }}</div>
                  <div v-if="p.signatures?.length > 0" class="text-xs text-green-600">
                    {{ p.signatures.length }} doc(s) signe(s)
                  </div>
                </div>
                <Tag :value="statusLabel(p.status)" :severity="statusSeverity(p.status)" class="text-xs" />
              </div>
            </div>
            <div v-else-if="searchQuery.length >= 2 && !isSearching" class="text-gray-400 text-sm text-center py-8">
              <i class="pi pi-search text-2xl mb-2"></i>
              <p>Aucun resultat</p>
            </div>
            <div v-else class="text-gray-300 text-sm text-center py-8">
              <i class="pi pi-users text-3xl mb-2"></i>
              <p>Saisissez un nom pour rechercher</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
