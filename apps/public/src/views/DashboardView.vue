<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config.store'
import { useCheckinStore, type ParticipantStatus } from '@/stores/checkin.store'
import { useAuthStore } from '@/stores/auth.store'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'

const router = useRouter()
const configStore = useConfigStore()
const checkinStore = useCheckinStore()
const auth = useAuthStore()

interface StatsData {
  total: number
  present: number
  signed: number
  absent: number
}

interface ParticipantRow {
  id: string
  status: ParticipantStatus
  data: Record<string, unknown>
}

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
    case 'SIGNED': return 'Present + Signe'
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
  } catch {
    // silently fail on refresh
  }
}

async function searchParticipants() {
  isLoadingList.value = true
  try {
    const p = await checkinStore.getParticipants({
      search: searchQuery.value || undefined, limit: 500,
    })
    participants.value = p.participants ?? p.data ?? p
    currentPage.value = 1
  } finally {
    isLoadingList.value = false
  }
}

function goToParticipant(id: string) {
  router.push(`/participant/${id}`)
}

function goToScanner() {
  router.push('/scanner')
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

onMounted(async () => {
  if (!configStore.config) {
    await configStore.loadConfig()
  }
  await loadData()
  refreshInterval = setInterval(loadData, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            {{ configStore.config?.app?.emoji }} {{ configStore.config?.app?.title ?? 'CheckFlow' }}
          </h1>
          <p class="text-sm text-gray-500">{{ configStore.config?.app?.subtitle }}</p>
        </div>
        <div class="flex gap-2">
          <Button
            icon="pi pi-qrcode"
            label="Scanner"
            severity="primary"
            @click="goToScanner"
          />
          <Button
            icon="pi pi-sign-out"
            severity="secondary"
            text
            @click="handleLogout"
          />
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div class="text-sm text-gray-500">Total</div>
          <div class="text-3xl font-bold text-gray-800 mt-1">{{ stats.total }}</div>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border-l-4 border-orange-400">
          <div class="text-sm text-orange-600">Presents</div>
          <div class="text-3xl font-bold text-orange-700 mt-1">{{ stats.present }}</div>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border-l-4 border-green-500">
          <div class="text-sm text-green-600">Signes</div>
          <div class="text-3xl font-bold text-green-700 mt-1">{{ stats.signed }}</div>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border-l-4 border-red-400">
          <div class="text-sm text-red-600">Absents</div>
          <div class="text-3xl font-bold text-red-700 mt-1">{{ stats.absent }}</div>
        </div>
      </div>

      <!-- Progress -->
      <div class="bg-white rounded-xl p-5 shadow-sm">
        <div class="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progression des signatures</span>
          <span class="font-semibold">{{ signProgress }}%</span>
        </div>
        <ProgressBar :value="signProgress" :showValue="false" class="h-3" />
      </div>

      <!-- Participant List -->
      <div class="bg-white rounded-xl shadow-sm">
        <div class="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div class="flex-1">
            <InputText
              v-model="searchQuery"
              placeholder="Rechercher un participant..."
              class="w-full"
              @input="searchParticipants"
            />
          </div>
        </div>

        <div class="px-4 pt-2">
          <div class="flex gap-2 pb-2">
            <button v-for="tab in [
              {v:'all',l:'Tous',c:participants.length},
              {v:'absent',l:'Absents',c:participants.filter(p=>p.status==='ABSENT').length},
              {v:'present',l:'Presents',c:participants.filter(p=>p.status==='PRESENT'||p.status==='SIGNED').length},
              {v:'signed',l:'Signes',c:participants.filter(p=>p.status==='SIGNED').length}
            ]" :key="tab.v"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="activeTab === tab.v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              @click="activeTab = tab.v; currentPage = 1"
            >{{ tab.l }} ({{ tab.c }})</button>
          </div>
        </div>

        <div class="divide-y divide-gray-100">
          <div
            v-for="p in paginatedParticipants"
            :key="p.id"
            class="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors"
            @click="goToParticipant(p.id)"
          >
            <div class="flex-1 flex items-center gap-3">
              <div
                v-for="field in configStore.listFields"
                :key="field.key"
                class="text-sm text-gray-700"
              >
                <span class="font-medium" v-if="field.key === 'nom'">
                  {{ getFieldValue(p, field.key) }}
                </span>
                <span v-else>{{ getFieldValue(p, field.key) }}</span>
              </div>
            </div>
            <Tag
              :value="statusLabel(p.status)"
              :severity="statusSeverity(p.status)"
            />
            <i class="pi pi-chevron-right text-gray-400 text-sm" />
          </div>

          <div
            v-if="filteredParticipants.length === 0"
            class="px-4 py-12 text-center text-gray-400"
          >
            Aucun participant trouve
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="px-4 py-3 border-t flex items-center justify-between text-sm">
          <span class="text-gray-500">
            {{ (currentPage - 1) * perPage + 1 }}-{{ Math.min(currentPage * perPage, filteredParticipants.length) }} sur {{ filteredParticipants.length }}
          </span>
          <div class="flex gap-1">
            <button class="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30" :disabled="currentPage <= 1" @click="currentPage--">
              <i class="pi pi-chevron-left text-xs"></i>
            </button>
            <button v-for="p in totalPages" :key="p"
              class="px-3 py-1 rounded border text-xs"
              :class="currentPage === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-100'"
              @click="currentPage = p"
            >{{ p }}</button>
            <button class="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30" :disabled="currentPage >= totalPages" @click="currentPage++">
              <i class="pi pi-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
