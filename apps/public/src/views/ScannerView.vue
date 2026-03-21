<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCheckinStore } from '../stores/checkin.store'
import { useConfigStore } from '../stores/config.store'
import { useAuthStore } from '../stores/auth.store'
import { useOfflineStore } from '../stores/offline.store'
import { Html5Qrcode } from 'html5-qrcode'
import Tag from 'primevue/tag'

const router = useRouter()
const checkin = useCheckinStore()
const config = useConfigStore()
const auth = useAuthStore()
const offline = useOfflineStore()

const scannerRef = ref<Html5Qrcode | null>(null)
const scannerRunning = ref(false)
const cameraAvailable = ref(true)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const isProcessing = ref(false)
const showSearch = ref(false)
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
function refocus() { if (hiddenInput.value && !showSearch.value) hiddenInput.value.focus() }

async function stopScanner() {
  if (scannerRunning.value && scannerRef.value) {
    try { await scannerRef.value.stop(); scannerRunning.value = false } catch {}
  }
}

async function loadStats() { try { stats.value = await checkin.getStats() } catch {} }

function openSearch() {
  showSearch.value = true
  searchQuery.value = ''
  searchResults.value = []
  nextTick(() => {
    const el = document.querySelector('#search-overlay input') as HTMLInputElement
    el?.focus()
  })
}

function closeSearch() {
  showSearch.value = false
  searchQuery.value = ''
  searchResults.value = []
  refocus()
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
    await stopScanner(); loadStats()
    router.push(`/participant/${result.participant.id}`)
  } catch (err: any) {
    if (!offline.isOnline || err?.code === 'ERR_NETWORK') {
      const cached = offline.findByQrCode(qrCode)
      if (cached) {
        const data = cached.data as Record<string, any>
        const name = `${data['prenom'] || ''} ${(data['nom'] || '').toUpperCase()}`.trim()
        playSuccess(); vibrate(200)
        lastScanResult.value = { name, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'OFFLINE' }
        await offline.addToQueue({ type: 'CHECKIN', participantId: cached.id })
        errorBanner.value = { type: 'info', message: `${name} — enregistre hors-ligne` }
        isProcessing.value = false; refocus(); return
      }
      playError()
      errorBanner.value = { type: 'info', message: 'Hors ligne — participant non trouve' }
    } else if (err?.response?.status === 404) {
      playError(); vibrate([100, 50, 100, 50, 100])
      errorBanner.value = { type: 'error', message: 'Badge non reconnu' }
    } else {
      playError(); errorBanner.value = { type: 'info', message: 'Erreur — reessayez' }
    }
    refocus()
  } finally {
    setTimeout(() => { isProcessing.value = false }, 500)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { if (showSearch.value) { closeSearch(); return } refocus(); return }
  if (showSearch.value) return
  if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== hiddenInput.value) return
  if (e.key === 'Enter' && barcodeBuffer.value.length > 2) { handleScan(barcodeBuffer.value.trim()); barcodeBuffer.value = ''; return }
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
    const result = await checkin.searchParticipants(q, 10)
    searchResults.value = result.participants || []
    // Let the operator manually select even if only one result
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
    playSuccess(); vibrate(200); await stopScanner(); loadStats(); closeSearch()
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
function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Signe' }

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  try {
    scannerRef.value = new Html5Qrcode('qr-reader')
    await scannerRef.value.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 280 } },
      (text) => handleScan(text), () => {})
    scannerRunning.value = true
  } catch { cameraAvailable.value = false }
  refocus(); loadStats()
  offline.init()
  offline.refreshCache()
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
  <div class="fixed inset-0 bg-gray-900 flex flex-col">
    <!-- Compact header -->
    <header class="bg-gray-800 px-4 py-2 flex items-center gap-3 z-20">
      <div class="flex-1 min-w-0">
        <span class="text-white font-semibold text-sm truncate">{{ config.config?.app?.emoji }} {{ config.config?.app?.title }}</span>
      </div>
      <!-- Online/Offline -->
      <div v-if="!offline.isOnline" class="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
        <i class="pi pi-wifi-off text-[10px]"></i> Hors ligne
        <span v-if="offline.hasPendingActions">({{ offline.pendingActions.length }})</span>
      </div>
      <div v-else-if="offline.hasPendingActions" class="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium cursor-pointer" @click="offline.syncQueue()">
        <i class="pi pi-sync text-[10px]"></i> {{ offline.pendingActions.length }}
      </div>
      <!-- Stats -->
      <div v-if="stats" class="flex items-center gap-3 text-xs">
        <span class="text-orange-400 font-bold">{{ stats.present }}</span>
        <span class="text-green-400 font-bold">{{ stats.signed }}</span>
        <span class="text-gray-500">/{{ stats.total }}</span>
      </div>
      <span class="text-gray-500 text-xs font-mono">{{ clock }}</span>
      <!-- Search button -->
      <button class="w-9 h-9 rounded-lg bg-gray-700 text-gray-300 flex items-center justify-center active:bg-gray-600" @click="openSearch">
        <i class="pi pi-search"></i>
      </button>
    </header>

    <!-- Last scan banner -->
    <div v-if="lastScanResult" class="px-4 py-2" :class="lastScanResult.status === 'SIGNED' ? 'bg-amber-500/10' : 'bg-green-500/10'">
      <div class="flex items-center gap-2 text-sm">
        <i :class="lastScanResult.status === 'SIGNED' ? 'pi pi-exclamation-circle text-amber-400' : 'pi pi-check-circle text-green-400'"></i>
        <span class="font-medium text-white">{{ lastScanResult.name }}</span>
        <span class="text-gray-500 text-xs">{{ lastScanResult.time }}</span>
        <Tag :value="lastScanResult.status === 'SIGNED' ? 'Deja signe' : 'OK'" :severity="lastScanResult.status === 'SIGNED' ? 'warn' : 'success'" class="text-xs ml-auto" />
      </div>
    </div>

    <!-- Error/Processing -->
    <div v-if="isProcessing" class="px-4 py-2 bg-blue-500/10">
      <div class="flex items-center gap-2 text-blue-400 text-sm"><i class="pi pi-spin pi-spinner"></i> Traitement...</div>
    </div>
    <div v-if="errorBanner && !isProcessing" class="px-4 py-2" :class="{
      'bg-red-500/10 text-red-400': errorBanner.type === 'error',
      'bg-amber-500/10 text-amber-400': errorBanner.type === 'warn',
      'bg-gray-500/10 text-gray-400': errorBanner.type === 'info',
    }">
      <div class="flex items-center justify-between text-sm">
        <span>{{ errorBanner.message }} <router-link v-if="errorBanner.link" :to="errorBanner.link" class="underline ml-2">Voir</router-link></span>
        <button class="text-xs underline opacity-60" @click="errorBanner = null; refocus()">x</button>
      </div>
    </div>

    <!-- Scanner area (fills remaining space) -->
    <div class="flex-1 flex items-center justify-center p-3">
      <div class="w-full max-w-md">
        <div class="rounded-2xl overflow-hidden bg-black relative">
          <div v-if="cameraAvailable" id="qr-reader" class="w-full"></div>
          <div v-else class="text-center text-gray-500 py-20">
            <i class="pi pi-video text-5xl mb-4"></i>
            <p class="text-lg">Camera non disponible</p>
            <p class="text-sm mt-2 text-gray-600">Utilisez Rechercher ou un lecteur USB</p>
          </div>
          <!-- Scanner active indicator -->
          <div v-if="scannerRunning" class="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span class="text-green-400 text-[10px] font-medium">LIVE</span>
          </div>
        </div>
      </div>
      <input ref="hiddenInput" class="opacity-0 absolute -z-10" tabindex="-1" aria-hidden="true" inputmode="none" readonly />
    </div>

    <!-- Search overlay -->
    <Teleport to="body">
      <Transition name="slide">
        <div v-if="showSearch" class="fixed inset-0 z-50 flex flex-col" id="search-overlay">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeSearch"></div>
          <div class="relative bg-white rounded-b-2xl shadow-2xl flex flex-col" style="max-height: 80vh;">
            <div class="px-4 pt-3 pb-3 flex items-center gap-3">
              <i class="pi pi-search text-gray-400"></i>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Nom ou prenom..."
                class="flex-1 min-w-0 text-lg outline-none bg-transparent"
                @input="onSearchInput"
                @keydown.escape="closeSearch"
                autofocus
              />
              <button v-if="searchQuery" class="text-gray-400 shrink-0" @click="searchQuery = ''; searchResults = []">
                <i class="pi pi-times"></i>
              </button>
              <button class="text-sm text-blue-600 font-medium shrink-0" @click="closeSearch">Fermer</button>
            </div>
            <div class="border-t"></div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="isSearching" class="flex items-center justify-center py-12 text-gray-400">
                <i class="pi pi-spin pi-spinner text-xl mr-3"></i> Recherche...
              </div>
              <div v-else-if="searchResults.length > 0" class="divide-y">
                <button v-for="p in searchResults" :key="p.id"
                  class="w-full flex items-center gap-4 px-4 py-4 active:bg-blue-50 text-left"
                  @click="selectParticipant(p)"
                >
                  <div class="w-12 h-12 rounded-full text-white flex items-center justify-center text-lg font-bold shrink-0"
                    :class="p.status === 'SIGNED' ? 'bg-green-500' : p.status === 'PRESENT' ? 'bg-blue-500' : 'bg-gray-400'"
                  >{{ getInitials(p.data) }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold">{{ getDisplayName(p.data) }}</div>
                    <div v-if="p.data?.commune" class="text-sm text-gray-500">{{ p.data.commune }}</div>
                  </div>
                  <Tag :value="statusLabel(p.status)" :severity="statusSeverity(p.status)" class="text-xs" />
                </button>
              </div>
              <div v-else-if="searchQuery.length >= 2 && !isSearching" class="text-center py-12 text-gray-400">
                <i class="pi pi-search text-3xl mb-3"></i>
                <p>Aucun resultat</p>
              </div>
              <div v-else class="text-center py-12 text-gray-300">
                <i class="pi pi-users text-4xl mb-3"></i>
                <p>Saisissez un nom</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.3s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; }
.slide-enter-from > div:last-child, .slide-leave-to > div:last-child { transform: translateY(100%); }
</style>
