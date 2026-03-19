<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events.store'
import Button from 'primevue/button'
import api from '../lib/axios'

const route = useRoute()
const router = useRouter()
const eventsStore = useEventsStore()
const slug = route.params.slug as string
const stats = ref<any>(null)

onMounted(async () => {
  await eventsStore.fetchEvent(slug)
  try { const { data } = await api.get(`/events/${slug}/export/stats`); stats.value = data } catch {}
})
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push('/events')" />
      <h1 class="text-2xl font-bold">{{ eventsStore.currentEvent?.logoEmoji }} {{ eventsStore.currentEvent?.title }}</h1>
    </div>
    <p v-if="eventsStore.currentEvent?.subtitle" class="text-gray-500 mb-6">{{ eventsStore.currentEvent.subtitle }}</p>
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl shadow p-4 text-center"><div class="text-3xl font-bold">{{ stats.total }}</div><div class="text-sm text-gray-500">Total</div></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><div class="text-3xl font-bold text-blue-600">{{ stats.present }}</div><div class="text-sm text-gray-500">Présents</div></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><div class="text-3xl font-bold text-green-600">{{ stats.signed }}</div><div class="text-sm text-gray-500">Signés</div></div>
      <div class="bg-white rounded-xl shadow p-4 text-center"><div class="text-3xl font-bold text-gray-400">{{ stats.absent }}</div><div class="text-sm text-gray-500">Absents</div></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Button label="Participants" icon="pi pi-users" severity="info" class="w-full" @click="router.push(`/events/${slug}/participants`)" />
      <Button label="Importer" icon="pi pi-upload" severity="secondary" class="w-full" @click="router.push(`/events/${slug}/import`)" />
      <Button label="Exporter" icon="pi pi-download" severity="secondary" class="w-full" @click="router.push(`/events/${slug}/export`)" />
      <Button label="Configuration" icon="pi pi-cog" severity="secondary" class="w-full" @click="router.push(`/events/${slug}/config`)" />
    </div>
  </div>
</template>
