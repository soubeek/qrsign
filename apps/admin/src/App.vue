<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.store'
import Button from 'primevue/button'
import Toast from 'primevue/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(true)

const isLoginPage = computed(() => route.name === 'login')
const showSidebar = computed(() => !isLoginPage.value && auth.isAuthenticated)

// Current event slug from route
const currentSlug = computed(() => (route.params.slug as string) || '')
const isInEvent = computed(() => !!currentSlug.value)

// Close sidebar on mobile after navigation
watch(() => route.path, () => {
  if (window.innerWidth < 1024) sidebarOpen.value = false
})

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <Toast />
  <div v-if="isLoginPage"><router-view /></div>
  <div v-else class="flex min-h-screen">
    <!-- Mobile hamburger -->
    <button v-if="showSidebar && !sidebarOpen"
      class="fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center lg:hidden shadow-lg"
      @click="sidebarOpen = true"
    >
      <i class="pi pi-bars"></i>
    </button>

    <!-- Overlay on mobile -->
    <div v-if="showSidebar && sidebarOpen"
      class="fixed inset-0 bg-black/30 z-40 lg:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside v-if="showSidebar"
      class="fixed lg:static z-50 lg:z-auto w-64 bg-gray-900 text-white flex flex-col shrink-0 h-screen transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h1 class="text-lg font-bold">QRSign Admin</h1>
        <button class="lg:hidden text-gray-400 hover:text-white" @click="sidebarOpen = false">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
        <!-- Main nav -->
        <router-link to="/events"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
          active-class="bg-gray-800 !text-white"
        >
          <i class="pi pi-calendar"></i> Evenements
        </router-link>

        <router-link v-if="auth.hasRole('SUPER_ADMIN', 'ADMIN')" to="/email"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
          active-class="bg-gray-800 !text-white"
        >
          <i class="pi pi-envelope"></i> Email
        </router-link>

        <router-link v-if="auth.hasRole('SUPER_ADMIN')" to="/users"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
          active-class="bg-gray-800 !text-white"
        >
          <i class="pi pi-users"></i> Utilisateurs
        </router-link>

        <router-link v-if="auth.hasRole('SUPER_ADMIN')" to="/audit"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
          active-class="bg-gray-800 !text-white"
        >
          <i class="pi pi-history"></i> Audit
        </router-link>

        <!-- Event sub-nav -->
        <template v-if="isInEvent">
          <div class="mt-4 mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evenement</div>
          <router-link :to="`/events/${currentSlug}`"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
            :class="route.name === 'event-detail' ? 'bg-gray-800 !text-white' : ''"
          >
            <i class="pi pi-home"></i> Vue d'ensemble
          </router-link>
          <router-link :to="`/events/${currentSlug}/participants`"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
            :class="route.name === 'participants' ? 'bg-gray-800 !text-white' : ''"
          >
            <i class="pi pi-users"></i> Participants
          </router-link>
          <router-link :to="`/events/${currentSlug}/import`"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
            :class="route.name === 'import' ? 'bg-gray-800 !text-white' : ''"
          >
            <i class="pi pi-upload"></i> Importer
          </router-link>
          <router-link :to="`/events/${currentSlug}/export`"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
            :class="route.name === 'export' ? 'bg-gray-800 !text-white' : ''"
          >
            <i class="pi pi-download"></i> Exporter
          </router-link>
          <router-link :to="`/events/${currentSlug}/config`"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
            :class="['event-config','fields-builder','document-editor','email-settings'].includes(route.name as string) ? 'bg-gray-800 !text-white' : ''"
          >
            <i class="pi pi-cog"></i> Configuration
          </router-link>
        </template>
      </nav>

      <div class="p-4 border-t border-gray-700">
        <div class="text-sm text-gray-400 mb-2">{{ auth.user?.firstName }} {{ auth.user?.lastName }}</div>
        <div class="text-xs text-gray-500 mb-2">{{ auth.user?.role }}</div>
        <Button label="Deconnexion" icon="pi pi-sign-out" severity="secondary" text size="small" class="!text-gray-400" @click="logout" />
      </div>
    </aside>

    <main class="flex-1 bg-gray-50 p-6 overflow-auto lg:ml-0" :class="showSidebar ? '' : ''">
      <router-view />
    </main>
  </div>
</template>
