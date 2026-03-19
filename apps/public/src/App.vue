<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Toast from 'primevue/toast'

const isFullscreen = ref(false)

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
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})
</script>

<template>
  <Toast position="top-center" />
  <RouterView />
  <!-- Fullscreen toggle button (bottom-right) -->
  <button
    @click="toggleFullscreen"
    class="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-gray-800/60 text-white flex items-center justify-center hover:bg-gray-800/80 transition-colors z-50 backdrop-blur-sm"
    :title="isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'"
  >
    <i :class="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" class="text-sm"></i>
  </button>
</template>
