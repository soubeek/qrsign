<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events.store'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const route = useRoute()
const router = useRouter()
const eventsStore = useEventsStore()
const toast = useToast()
const slug = route.params.slug as string
const form = ref<any>({})

// Access management
const allUsers = ref<any[]>([])
const assignedUsers = ref<any[]>([])
const showAddAccess = ref(false)
const selectedUserId = ref<string | null>(null)
const selectedRole = ref('OPERATOR')
const roles = [
  { label: 'Administrateur', value: 'ADMIN' },
  { label: 'Operateur', value: 'OPERATOR' },
  { label: 'Observateur', value: 'VIEWER' },
]

const availableUsers = computed(() => {
  const assignedIds = assignedUsers.value.map(u => u.userId)
  return allUsers.value.filter(u => !assignedIds.includes(u.id) && u.role !== 'SUPER_ADMIN')
})

onMounted(async () => {
  await eventsStore.fetchEvent(slug)
  if (eventsStore.currentEvent) {
    form.value = { ...eventsStore.currentEvent }
  }
  await loadAccess()
})

async function loadAccess() {
  try {
    const { data: users } = await api.get('/users')
    allUsers.value = users || []

    // Get event with userAccess
    const { data: event } = await api.get(`/events/${slug}`)
    assignedUsers.value = (event.userAccess || []).map((ua: any) => ({
      ...ua,
      user: allUsers.value.find(u => u.id === ua.userId) || { firstName: '?', lastName: '?', email: '?', role: '?' },
    }))
  } catch {}
}

async function saveGeneral() {
  try {
    await eventsStore.updateEvent(slug, form.value)
    toast.add({ severity: 'success', summary: 'Sauvegarde', life: 2000 })
  } catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}

async function addAccess() {
  if (!selectedUserId.value) return
  try {
    await api.post(`/users/${selectedUserId.value}/events`, {
      eventId: eventsStore.currentEvent?.id,
      eventRole: selectedRole.value,
    })
    showAddAccess.value = false
    selectedUserId.value = null
    selectedRole.value = 'OPERATOR'
    await loadAccess()
    toast.add({ severity: 'success', summary: 'Acces ajoute', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e?.response?.data?.message, life: 3000 })
  }
}

async function removeAccess(userId: string) {
  try {
    await api.delete(`/users/${userId}/events/${eventsStore.currentEvent?.id}`)
    await loadAccess()
    toast.add({ severity: 'success', summary: 'Acces retire', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  }
}

function roleSeverity(role: string) {
  if (role === 'SUPER_ADMIN') return 'danger'
  if (role === 'ADMIN') return 'warn'
  if (role === 'OPERATOR') return 'info'
  return 'secondary'
}

function roleLabel(role: string) {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin'
    case 'ADMIN': return 'Admin'
    case 'OPERATOR': return 'Operateur'
    case 'VIEWER': return 'Observateur'
    default: return role
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push(`/events/${slug}`)" />
      <h1 class="text-2xl font-bold">Configuration</h1>
    </div>
    <TabView>
      <TabPanel header="General">
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
      <TabPanel header="Documents">
        <div class="p-4">
          <Button label="Ouvrir l'editeur de documents" icon="pi pi-file" @click="router.push(`/events/${slug}/config/document`)" />
        </div>
      </TabPanel>
      <TabPanel header="Acces">
        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <p class="text-gray-600">Utilisateurs ayant acces a cet evenement</p>
            <Button label="Ajouter un acces" icon="pi pi-plus" size="small" @click="showAddAccess = true" />
          </div>

          <DataTable :value="assignedUsers" rowHover>
            <Column header="Nom">
              <template #body="{ data }">
                <div class="font-medium">{{ data.user?.firstName }} {{ data.user?.lastName }}</div>
                <div class="text-sm text-gray-500">{{ data.user?.email }}</div>
              </template>
            </Column>
            <Column header="Role global">
              <template #body="{ data }">
                <Tag :value="roleLabel(data.user?.role)" :severity="roleSeverity(data.user?.role)" />
              </template>
            </Column>
            <Column header="Role evenement">
              <template #body="{ data }">
                <Tag v-if="data.eventRole" :value="roleLabel(data.eventRole)" :severity="roleSeverity(data.eventRole)" />
                <span v-else class="text-gray-400 text-sm">Role global</span>
              </template>
            </Column>
            <Column header="Actions" style="width: 80px">
              <template #body="{ data }">
                <Button icon="pi pi-trash" severity="danger" text size="small" @click="removeAccess(data.userId)" />
              </template>
            </Column>
          </DataTable>

          <div v-if="assignedUsers.length === 0" class="text-center py-8 text-gray-400">
            Aucun utilisateur assigne. Les SUPER_ADMIN ont acces a tous les evenements.
          </div>
        </div>
      </TabPanel>
    </TabView>

    <!-- Add access dialog -->
    <Dialog v-model:visible="showAddAccess" header="Ajouter un acces" modal class="w-full max-w-md">
      <div class="space-y-4 p-2">
        <div>
          <label class="text-sm font-medium">Utilisateur</label>
          <Dropdown
            v-model="selectedUserId"
            :options="availableUsers"
            optionLabel="email"
            optionValue="id"
            placeholder="Selectionner un utilisateur"
            class="w-full mt-1"
            filter
          >
            <template #option="{ option }">
              <div>
                <span class="font-medium">{{ option.firstName }} {{ option.lastName }}</span>
                <span class="text-gray-400 ml-2">{{ option.email }}</span>
              </div>
            </template>
          </Dropdown>
        </div>
        <div>
          <label class="text-sm font-medium">Role sur cet evenement</label>
          <Dropdown
            v-model="selectedRole"
            :options="roles"
            optionLabel="label"
            optionValue="value"
            class="w-full mt-1"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showAddAccess = false" />
        <Button label="Ajouter" icon="pi pi-check" :disabled="!selectedUserId" @click="addAccess" />
      </template>
    </Dialog>
  </div>
</template>
