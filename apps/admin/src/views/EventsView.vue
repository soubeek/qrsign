<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events.store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import api from '../lib/axios'

const router = useRouter()
const eventsStore = useEventsStore()
const showCreate = ref(false)
const newEvent = ref({ title: '', subtitle: '', logoEmoji: '', entitySingular: 'participant', entityPlural: 'participants' })
const eventStats = ref<Record<string, any>>({})

onMounted(async () => {
  await eventsStore.fetchEvents()
  // Load stats for each event
  for (const event of eventsStore.events) {
    try {
      const { data } = await api.get(`/events/${event.slug}/export/stats`)
      eventStats.value[event.slug] = data
    } catch {}
  }
})

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function createEvent() {
  await eventsStore.createEvent({ ...newEvent.value, slug: slugify(newEvent.value.title) })
  showCreate.value = false
  newEvent.value = { title: '', subtitle: '', logoEmoji: '', entitySingular: 'participant', entityPlural: 'participants' }
}

function goToEvent(e: any) { router.push(`/events/${e.data.slug}`) }

function signProgress(slug: string): number {
  const s = eventStats.value[slug]
  if (!s || s.total === 0) return 0
  return Math.round((s.signed / s.total) * 100)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Evenements</h1>
      <Button label="Creer un evenement" icon="pi pi-plus" @click="showCreate = true" />
    </div>

    <DataTable :value="eventsStore.events" :loading="eventsStore.isLoading" rowHover @row-click="goToEvent" class="cursor-pointer">
      <Column header="Evenement">
        <template #body="{ data }">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ data.logoEmoji }}</span>
            <div>
              <div class="font-semibold">{{ data.title }}</div>
              <div class="text-sm text-gray-500">{{ data.subtitle || data.entityPlural }}</div>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Participants">
        <template #body="{ data }">
          <div v-if="eventStats[data.slug]" class="min-w-32">
            <div class="text-sm mb-1">
              <span class="font-semibold">{{ eventStats[data.slug].signed }}</span>
              <span class="text-gray-400"> / {{ eventStats[data.slug].total }} signes</span>
            </div>
            <ProgressBar :value="signProgress(data.slug)" :showValue="false" class="h-2" />
          </div>
          <span v-else class="text-gray-400 text-sm">—</span>
        </template>
      </Column>
      <Column header="Presence">
        <template #body="{ data }">
          <div v-if="eventStats[data.slug]" class="text-sm">
            <span class="text-blue-600 font-medium">{{ eventStats[data.slug].present }}</span>
            <span class="text-gray-400"> presents, </span>
            <span class="text-gray-500">{{ eventStats[data.slug].absent }}</span>
            <span class="text-gray-400"> absents</span>
          </div>
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data }">
          <Tag :value="data.isActive ? 'Actif' : 'Inactif'" :severity="data.isActive ? 'success' : 'secondary'" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Creer un evenement" modal class="w-full max-w-lg">
      <div class="space-y-4 p-2">
        <div><label class="text-sm font-medium">Titre</label><InputText v-model="newEvent.title" class="w-full mt-1" placeholder="Conseil Municipal" /></div>
        <div><label class="text-sm font-medium">Sous-titre</label><InputText v-model="newEvent.subtitle" class="w-full mt-1" placeholder="Installation du conseil" /></div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-sm font-medium">Emoji</label><InputText v-model="newEvent.logoEmoji" class="w-full mt-1" placeholder="" /></div>
          <div><label class="text-sm font-medium">Singulier</label><InputText v-model="newEvent.entitySingular" class="w-full mt-1" /></div>
          <div><label class="text-sm font-medium">Pluriel</label><InputText v-model="newEvent.entityPlural" class="w-full mt-1" /></div>
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showCreate = false" />
        <Button label="Creer" icon="pi pi-check" @click="createEvent" :disabled="!newEvent.title" />
      </template>
    </Dialog>
  </div>
</template>
