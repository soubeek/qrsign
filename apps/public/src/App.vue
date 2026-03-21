<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Toast from 'primevue/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// PWA Install prompt
const deferredPrompt = ref<any>(null)
const showInstallBanner = ref(false)

// Fullscreen
const isFullscreen = ref(false)

// Bottom nav visibility — hide on login, signature, confirmation
const showBottomNav = computed(() => {
  const name = route.name as string
  return auth.isAuthenticated && !['Login', 'Signature', 'Confirmation'].includes(name)
})

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

async function installPWA() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') showInstallBanner.value = false
  deferredPrompt.value = null
}

function dismissInstall() {
  showInstallBanner.value = false
  localStorage.setItem('pwa_install_dismissed', Date.now().toString())
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch {}
}

onMounted(() => {
  // Prevent iOS Safari bounce/overscroll on body
  document.body.addEventListener('touchmove', (e) => {
    if (e.target === document.body || e.target === document.documentElement) {
      e.preventDefault()
    }
  }, { passive: false })

  // Fullscreen tracking
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
    // Don't show if dismissed less than 7 days ago
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400 * 1000) return
    showInstallBanner.value = true
  })
})
</script>

<template>
  <Toast position="top-center" />

  <!-- PWA Install Banner -->
  <Transition name="slide-down">
    <div v-if="showInstallBanner" class="fixed top-0 inset-x-0 z-[60] safe-top">
      <div class="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        <i class="pi pi-download text-xl"></i>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">Installer CheckFlow</div>
          <div class="text-xs text-blue-100">Acces rapide depuis l'ecran d'accueil</div>
        </div>
        <button
          class="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-semibold shrink-0"
          @click="installPWA"
        >Installer</button>
        <button class="p-1 text-blue-200" @click="dismissInstall">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
  </Transition>

  <!-- Main content — fills viewport, no scroll -->
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
          class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors text-gray-400"
          @click="toggleFullscreen"
        >
          <i :class="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" class="text-xl"></i>
          <span class="text-[10px] font-medium">{{ isFullscreen ? 'Fenetre' : 'Plein ecran' }}</span>
        </button>
      </div>
    </nav>
  </Transition>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.25s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}
.slide-down-enter-active, .slide-down-leave-active {
  transition: transform 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-100%);
}
</style>
