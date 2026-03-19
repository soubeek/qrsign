<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Dropdown from 'primevue/dropdown'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const toast = useToast()
const users = ref<any[]>([])
const isLoading = ref(false)
const showCreate = ref(false)
const newUser = ref({ email: '', firstName: '', lastName: '', role: 'OPERATOR', password: '' })
const roles = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']

onMounted(loadUsers)

async function loadUsers() { isLoading.value = true; try { const { data } = await api.get('/users'); users.value = data } catch {} finally { isLoading.value = false } }

async function createUser() {
  try { await api.post('/users', newUser.value); showCreate.value = false; newUser.value = { email: '', firstName: '', lastName: '', role: 'OPERATOR', password: '' }; loadUsers(); toast.add({ severity: 'success', summary: 'Utilisateur créé', life: 2000 }) }
  catch (e: any) { toast.add({ severity: 'error', summary: 'Erreur', detail: e?.response?.data?.message, life: 3000 }) }
}

async function updateRole(user: any) {
  try { await api.patch(`/users/${user.id}`, { role: user.role }); toast.add({ severity: 'success', summary: 'Rôle mis à jour', life: 2000 }) }
  catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}

async function toggleActive(user: any) {
  try { await api.patch(`/users/${user.id}`, { isActive: user.isActive }) }
  catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}

async function resetPassword(id: string) {
  try { await api.post(`/users/${id}/reset-password`); toast.add({ severity: 'success', summary: 'Mot de passe réinitialisé', life: 3000 }) }
  catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}

function roleSeverity(role: string) {
  if (role === 'SUPER_ADMIN') return 'danger'
  if (role === 'ADMIN') return 'warn'
  if (role === 'OPERATOR') return 'info'
  return 'secondary'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Utilisateurs</h1>
      <Button label="Créer un utilisateur" icon="pi pi-plus" @click="showCreate = true" />
    </div>
    <DataTable :value="users" :loading="isLoading" rowHover>
      <Column header="Nom"><template #body="{ data }">{{ data.firstName }} {{ data.lastName }}</template></Column>
      <Column field="email" header="Email" />
      <Column header="Rôle">
        <template #body="{ data }">
          <Dropdown v-model="data.role" :options="roles" class="text-sm" @change="updateRole(data)" />
        </template>
      </Column>
      <Column header="Actif"><template #body="{ data }"><ToggleSwitch v-model="data.isActive" @change="toggleActive(data)" /></template></Column>
      <Column header="Actions">
        <template #body="{ data }">
          <Button icon="pi pi-key" severity="secondary" text size="small" title="Réinitialiser le mot de passe" @click="resetPassword(data.id)" />
        </template>
      </Column>
    </DataTable>
    <Dialog v-model:visible="showCreate" header="Créer un utilisateur" modal class="w-full max-w-md">
      <div class="space-y-4 p-2">
        <div><label class="text-sm font-medium">Email</label><InputText v-model="newUser.email" type="email" class="w-full mt-1" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm font-medium">Prénom</label><InputText v-model="newUser.firstName" class="w-full mt-1" /></div>
          <div><label class="text-sm font-medium">Nom</label><InputText v-model="newUser.lastName" class="w-full mt-1" /></div>
        </div>
        <div><label class="text-sm font-medium">Rôle</label><Dropdown v-model="newUser.role" :options="roles" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Mot de passe temporaire</label><Password v-model="newUser.password" :feedback="false" toggleMask class="w-full mt-1" inputClass="w-full" /></div>
      </div>
      <template #footer><Button label="Créer" icon="pi pi-check" @click="createUser" /><Button label="Annuler" severity="secondary" text @click="showCreate = false" /></template>
    </Dialog>
  </div>
</template>
