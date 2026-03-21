<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Toast from 'primevue/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// PWA Install
const deferredPrompt = ref<any>(null)
const showInstallModal = ref(false)
const isStandalone = ref(false)
const isIOS = ref(false)

// Bottom nav visibility
const showBottomNav = computed(() => {
  const name = route.name as string
  return auth.isAuthenticated && !['Login', 'Signature', 'Confirmation'].includes(name)
})

// Hide install button if already installed
const showInstallButton = computed(() => !isStandalone.value)

const activeTab = computed(() => {
  const name = route.name as string
  if (name === 'Scanner') return 'scanner'
  if (name === 'Participant') return 'home'
  return name === 'Dashboard' ? 'home' : 'scanner'
})

function navigate(tab: string) {
  if (tab === 'scanner') router.push('/scanner')
  else if (tab === 'home') router.push('/')
}

function openInstallModal() {
  showInstallModal.value = true
}

async function installPWA() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      showInstallModal.value = false
      isStandalone.value = true
    }
    deferredPrompt.value = null
  }
}

// Force viewport height recalculation (iOS Safari)
function fixViewport() {
  const h = window.innerHeight + 'px'
  document.documentElement.style.height = h
  document.body.style.height = h
  const app = document.getElementById('app')
  if (app) app.style.height = h
}

onMounted(() => {
  // Detect standalone (already installed as PWA)
  const standaloneQuery = window.matchMedia('(display-mode: standalone)')
  isStandalone.value = standaloneQuery.matches || (navigator as any).standalone === true
  standaloneQuery.addEventListener('change', (e) => { isStandalone.value = e.matches })

  // Detect iOS
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // Lock viewport on iOS
  fixViewport()
  window.addEventListener('resize', fixViewport)
  window.addEventListener('orientationchange', () => setTimeout(fixViewport, 300))

  // Prevent iOS Safari bounce/overscroll on body
  document.body.addEventListener('touchmove', (e) => {
    let target = e.target as HTMLElement | null
    while (target && target !== document.body) {
      const style = window.getComputedStyle(target)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return
      target = target.parentElement
    }
    e.preventDefault()
  }, { passive: false })

  // Fullscreen tracking
  document.addEventListener('fullscreenchange', () => {
    isStandalone.value = !!document.fullscreenElement
  })

  // PWA install prompt (Android/Chrome)
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
  })

  // Detect when app gets installed
  window.addEventListener('appinstalled', () => {
    isStandalone.value = true
    showInstallModal.value = false
    deferredPrompt.value = null
  })
})
</script>

<template>
  <Toast position="top-center" />

  <!-- Main content -->
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;" :style="showBottomNav ? 'padding-bottom: 4.5rem;' : ''">
    <RouterView />
  </div>

  <!-- Bottom Navigation Bar -->
  <Transition name="slide-up">
    <nav v-if="showBottomNav" class="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 safe-bottom">
      <div class="flex items-stretch max-w-lg mx-auto">
        <button
          class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
          :class="activeTab === 'scanner' ? 'text-blue-600' : 'text-gray-400'"
          @click="navigate('scanner')"
        >
          <i class="pi pi-qrcode text-xl"></i>
          <span class="text-[10px] font-medium">Scanner</span>
        </button>

        <button
          class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
          :class="activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'"
          @click="navigate('home')"
        >
          <i class="pi pi-list text-xl"></i>
          <span class="text-[10px] font-medium">Participants</span>
        </button>

        <button
          v-if="showInstallButton"
          class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors text-gray-400"
          @click="openInstallModal"
        >
          <i class="pi pi-download text-xl"></i>
          <span class="text-[10px] font-medium">Installer</span>
        </button>
      </div>
    </nav>
  </Transition>

  <!-- Install Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showInstallModal" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showInstallModal = false"></div>
        <div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm mx-auto p-6 space-y-4">
          <!-- Header -->
          <div class="flex items-center gap-3">
            <img src="/icon-192.png" alt="CheckFlow" class="w-14 h-14 rounded-xl shadow" />
            <div>
              <h2 class="text-lg font-bold text-gray-800">Installer CheckFlow</h2>
              <p class="text-sm text-gray-500">Ajouter a l'ecran d'accueil</p>
            </div>
          </div>

          <div class="text-sm text-gray-600 space-y-2">
            <p>L'application sera accessible comme une app native :</p>
            <ul class="space-y-1.5 ml-1">
              <li class="flex items-center gap-2"><i class="pi pi-check-circle text-green-500 text-xs"></i> Icone sur l'ecran d'accueil</li>
              <li class="flex items-center gap-2"><i class="pi pi-check-circle text-green-500 text-xs"></i> Plein ecran sans barre navigateur</li>
              <li class="flex items-center gap-2"><i class="pi pi-check-circle text-green-500 text-xs"></i> Mode portrait verrouille</li>
              <li class="flex items-center gap-2"><i class="pi pi-check-circle text-green-500 text-xs"></i> Acces hors-ligne</li>
            </ul>
          </div>

          <!-- Android: direct install -->
          <button
            v-if="deferredPrompt"
            class="w-full py-3 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
            style="background-color: #2563eb; color: white;"
            @click="installPWA"
          >
            <i class="pi pi-download"></i> Installer maintenant
          </button>

          <!-- iOS instructions -->
          <div v-else-if="isIOS" class="space-y-3">
            <div class="p-3 rounded-xl text-sm" style="background-color: #f0f9ff; color: #1e40af;">
              <p class="font-semibold mb-2">Sur Safari :</p>
              <ol class="space-y-1.5 ml-1">
                <li class="flex items-start gap-2">
                  <span class="font-bold shrink-0">1.</span>
                  <span>Appuyez sur <i class="pi pi-external-link text-xs"></i> (bouton Partager)</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-bold shrink-0">2.</span>
                  <span>Faites defiler et appuyez sur <strong>"Sur l'ecran d'accueil"</strong></span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-bold shrink-0">3.</span>
                  <span>Appuyez sur <strong>"Ajouter"</strong></span>
                </li>
              </ol>
            </div>
          </div>

          <!-- Android without prompt (Chrome menu) -->
          <div v-else class="space-y-3">
            <div class="p-3 rounded-xl text-sm" style="background-color: #f0f9ff; color: #1e40af;">
              <p class="font-semibold mb-2">Sur Chrome :</p>
              <ol class="space-y-1.5 ml-1">
                <li class="flex items-start gap-2">
                  <span class="font-bold shrink-0">1.</span>
                  <span>Appuyez sur <strong>&#8942;</strong> (menu 3 points)</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-bold shrink-0">2.</span>
                  <span>Appuyez sur <strong>"Installer l'application"</strong> ou <strong>"Ajouter a l'ecran d'accueil"</strong></span>
                </li>
              </ol>
            </div>
          </div>

          <button
            class="w-full py-2.5 rounded-xl font-medium text-sm"
            style="background-color: #f3f4f6; color: #374151;"
            @click="showInstallModal = false"
          >Fermer</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.25s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
