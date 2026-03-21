<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config.store'
import { useCheckinStore, type ParticipantStatus } from '@/stores/checkin.store'
import { useAuthStore } from '@/stores/auth.store'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'

const router = useRouter()
const configStore = useConfigStore()
const checkinStore = useCheckinStore()
const auth = useAuthStore()

interface StatsData { total: number; present: number; signed: number; absent: number }
interface ParticipantRow { id: string; status: ParticipantStatus; data: Record<string, unknown> }

const stats = ref<StatsData>({ total: 0, present: 0, signed: 0, absent: 0 })
const participants = ref<ParticipantRow[]>([])
const searchQuery = ref('')
const activeTab = ref('all')
const isLoadingList = ref(false)
const currentPage = ref(1)
const perPage = 20

let refreshInterval: ReturnType<typeof setInterval> | null = null

const signProgress = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.signed / stats.value.total) * 100)
})

const filteredParticipants = computed(() => {
  let list = participants.value
  if (activeTab.value === 'absent') list = list.filter((p) => p.status === 'ABSENT')
  else if (activeTab.value === 'present') list = list.filter((p) => p.status === 'PRESENT' || p.status === 'SIGNED')
  else if (activeTab.value === 'signed') list = list.filter((p) => p.status === 'SIGNED')
  return list
})

const totalPages = computed(() => Math.ceil(filteredParticipants.value.length / perPage))
const paginatedParticipants = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredParticipants.value.slice(start, start + perPage)
})

function statusSeverity(status: ParticipantStatus): 'danger' | 'warn' | 'success' {
  switch (status) {
    case 'ABSENT': return 'danger'
    case 'PRESENT': return 'warn'
    case 'SIGNED': return 'success'
  }
}

function statusLabel(status: ParticipantStatus): string {
  switch (status) {
    case 'ABSENT': return 'Absent'
    case 'PRESENT': return 'Present'
    case 'SIGNED': return 'Signe'
  }
}

function getFieldValue(row: ParticipantRow, key: string): string {
  return String(row.data[key] ?? '')
}

async function loadData() {
  try {
    const [s, p] = await Promise.all([
      checkinStore.getStats(),
      checkinStore.getParticipants({ search: searchQuery.value || undefined, limit: 500 }),
    ])
    stats.value = s
    participants.value = p.participants ?? p.data ?? p
  } catch {}
}

async function searchParticipants() {
  isLoadingList.value = true
  try {
    const p = await checkinStore.getParticipants({ search: searchQuery.value || undefined, limit: 500 })
    participants.value = p.participants ?? p.data ?? p
    currentPage.value = 1
  } finally { isLoadingList.value = false }
}

function goToParticipant(id: string) { router.push(`/participant/${id}`) }

async function handleLogout() { await auth.logout(); router.push('/login') }

onMounted(async () => {
  if (!configStore.config) await configStore.loadConfig()
  await loadData()
  refreshInterval = setInterval(loadData, 30000)
})
onUnmounted(() => { if (refreshInterval) clearInterval(refreshInterval) })
</script>

<template>
  <div class="app-fixed-layout bg-gray-50">
    <!-- Fixed: Header -->
    <header class="bg-white shadow-sm border-b border-gray-200 z-20 shrink-0">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="min-w-0">
          <h1 class="text-lg sm:text-xl font-bold text-gray-800 truncate">
            {{ configStore.config?.app?.emoji }} {{ configStore.config?.app?.title ?? 'CheckFlow' }}
          </h1>
        </div>
        <button
          class="text-gray-400 hover:text-gray-600 p-2"
          @click="handleLogout"
          title="Deconnexion"
        >
          <i class="pi pi-sign-out text-lg"></i>
        </button>
      </div>
    </header>

    <!-- Fixed: Stats + Search + Filters -->
    <div class="bg-gray-50 shrink-0 max-w-7xl mx-auto w-full px-3 pt-3 pb-1 space-y-2">
      <!-- Stats compact -->
      <div class="grid grid-cols-4 gap-2">
        <div class="bg-white rounded-lg p-2 shadow-sm border border-gray-100 text-center">
          <div class="text-[10px] text-gray-500 uppercase">Total</div>
          <div class="text-xl font-bold text-gray-800">{{ stats.total }}</div>
        </div>
        <div class="bg-white rounded-lg p-2 shadow-sm border-l-3 border-orange-400 text-center">
          <div class="text-[10px] text-orange-600 uppercase">Presents</div>
          <div class="text-xl font-bold text-orange-700">{{ stats.present }}</div>
        </div>
        <div class="bg-white rounded-lg p-2 shadow-sm border-l-3 border-green-500 text-center">
          <div class="text-[10px] text-green-600 uppercase">Signes</div>
          <div class="text-xl font-bold text-green-700">{{ stats.signed }}</div>
        </div>
        <div class="bg-white rounded-lg p-2 shadow-sm border-l-3 border-red-400 text-center">
          <div class="text-[10px] text-red-600 uppercase">Absents</div>
          <div class="text-xl font-bold text-red-700">{{ stats.absent }}</div>
        </div>
      </div>

      <!-- Search -->
      <InputText
        v-model="searchQuery"
        placeholder="Rechercher..."
        class="w-full"
        @input="searchParticipants"
      />

      <!-- Filter tabs -->
      <div class="overflow-x-auto">
        <div class="flex gap-1.5 min-w-max">
          <button v-for="tab in [
            {v:'all',l:'Tous',c:participants.length},
            {v:'absent',l:'Absents',c:participants.filter(p=>p.status==='ABSENT').length},
            {v:'present',l:'Presents',c:participants.filter(p=>p.status==='PRESENT'||p.status==='SIGNED').length},
            {v:'signed',l:'Signes',c:participants.filter(p=>p.status==='SIGNED').length}
          ]" :key="tab.v"
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
            :style="activeTab === tab.v ? 'background-color:#2563eb;color:white;' : 'background-color:#f3f4f6;color:#4b5563;'"
            @click="activeTab = tab.v; currentPage = 1"
          >{{ tab.l }} ({{ tab.c }})</button>
        </div>
      </div>
    </div>

    <!-- Scrollable: List only -->
    <div class="flex-1 overflow-y-auto pb-20">
      <div class="max-w-7xl mx-auto px-3">
        <div class="bg-white rounded-xl shadow-sm mt-2">
        <div class="divide-y divide-gray-100">
          <button
            v-for="p in paginatedParticipants"
            :key="p.id"
            class="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50 text-left transition-colors"
            @click="goToParticipant(p.id)"
          >
            <!-- Status dot -->
            <div class="w-3 h-3 rounded-full shrink-0"
              :class="{
                'bg-red-400': p.status === 'ABSENT',
                'bg-orange-400': p.status === 'PRESENT',
                'bg-green-500': p.status === 'SIGNED',
              }"
            ></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-for="field in configStore.listFields" :key="field.key"
                  class="text-sm"
                  :class="field.key === 'nom' ? 'font-semibold text-gray-800' : 'text-gray-500'"
                >{{ getFieldValue(p, field.key) }}</span>
              </div>
            </div>
            <Tag
              :value="statusLabel(p.status)"
              :severity="statusSeverity(p.status)"
              class="text-xs shrink-0"
            />
            <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
          </button>

          <div v-if="filteredParticipants.length === 0" class="px-4 py-12 text-center text-gray-400">
            Aucun participant trouve
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="px-4 py-3 border-t flex items-center justify-between text-sm">
          <span class="text-gray-500 text-xs">
            {{ (currentPage - 1) * perPage + 1 }}-{{ Math.min(currentPage * perPage, filteredParticipants.length) }} / {{ filteredParticipants.length }}
          </span>
          <div class="flex gap-1">
            <button class="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center active:bg-gray-100 disabled:opacity-30" :disabled="currentPage <= 1" @click="currentPage--">
              <i class="pi pi-chevron-left text-xs"></i>
            </button>
            <button class="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center active:bg-gray-100 disabled:opacity-30" :disabled="currentPage >= totalPages" @click="currentPage++">
              <i class="pi pi-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>
