<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events.store'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import api from '../lib/axios'
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const router = useRouter()
const eventsStore = useEventsStore()
const toast = useToast()
const slug = route.params.slug as string
const form = ref<any>({})
const accessUsers = ref<any[]>([])

onMounted(async () => {
  await eventsStore.fetchEvent(slug)
  if (eventsStore.currentEvent) {
    form.value = { ...eventsStore.currentEvent }
  }
  try { const { data } = await api.get(`/users`); accessUsers.value = data } catch {}
})

async function saveGeneral() {
  try {
    await eventsStore.updateEvent(slug, form.value)
    toast.add({ severity: 'success', summary: 'Sauvegardé', life: 2000 })
  } catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push(`/events/${slug}`)" />
      <h1 class="text-2xl font-bold">Configuration</h1>
    </div>
    <TabView>
      <TabPanel header="Général">
        <div class="space-y-4 max-w-xl p-4">
          <div><label class="text-sm font-medium">Titre</label><InputText v-model="form.title" class="w-full mt-1" /></div>
          <div><label class="text-sm font-medium">Sous-titre</label><InputText v-model="form.subtitle" class="w-full mt-1" /></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="text-sm font-medium">Emoji</label><InputText v-model="form.logoEmoji" class="w-full mt-1" /></div>
            <div><label class="text-sm font-medium">Singulier</label><InputText v-model="form.entitySingular" class="w-full mt-1" /></div>
            <div><label class="text-sm font-medium">Pluriel</label><InputText v-model="form.entityPlural" class="w-full mt-1" /></div>
          </div>
          <div><label class="text-sm font-medium">Template nom</label><InputText v-model="form.displayNameTpl" class="w-full mt-1" /></div>
          <Button label="Sauvegarder" icon="pi pi-check" @click="saveGeneral" />
        </div>
      </TabPanel>
      <TabPanel header="Champs">
        <div class="p-4">
          <Button label="Ouvrir le constructeur de champs" icon="pi pi-list" @click="router.push(`/events/${slug}/config/fields`)" />
        </div>
      </TabPanel>
      <TabPanel header="Document">
        <div class="p-4">
          <Button label="Ouvrir l'éditeur de document" icon="pi pi-file" @click="router.push(`/events/${slug}/config/document`)" />
        </div>
      </TabPanel>
      <TabPanel header="Email">
        <div class="p-4">
          <Button label="Ouvrir les paramètres email" icon="pi pi-envelope" @click="router.push(`/events/${slug}/config/email`)" />
        </div>
      </TabPanel>
      <TabPanel header="Accès">
        <div class="p-4">
          <p class="text-gray-500 mb-4">Gérez les utilisateurs ayant accès à cet événement depuis la page <router-link to="/users" class="text-blue-600 underline">Utilisateurs</router-link>.</p>
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>
