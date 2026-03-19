<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useParticipantsStore } from '../stores/participants.store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const route = useRoute()
const participantsStore = useParticipantsStore()
const toast = useToast()
const slug = route.params.slug as string
const search = ref('')
const statusFilter = ref<string | undefined>(undefined)
const fields = ref<any[]>([])
const showEdit = ref(false)
const showResetConfirm = ref(false)
const resetTarget = ref<any>(null)
const editParticipant = ref<any>(null)
const editData = ref<Record<string, any>>({})
const showDeleteConfirm = ref(false)
const deleteTarget = ref<any>(null)
const showCreate = ref(false)
const newParticipant = ref<Record<string, any>>({})

const tabs = [
  { label: 'Tous', value: undefined },
  { label: 'Absents', value: 'ABSENT' },
  { label: 'Presents', value: 'PRESENT' },
  { label: 'Signes', value: 'SIGNED' },
]

const displayFields = computed(() => fields.value.filter((f: any) => f.displayInList))

// Counts per status
const counts = computed(() => {
  const list = participantsStore.participants
  return {
    all: list.length,
    ABSENT: list.filter(p => p.status === 'ABSENT').length,
    PRESENT: list.filter(p => p.status === 'PRESENT' || p.status === 'SIGNED').length,
    SIGNED: list.filter(p => p.status === 'SIGNED').length,
  }
})

onMounted(async () => {
  const { data: f } = await api.get(`/events/${slug}/fields`)
  fields.value = f || []
  loadParticipants()
})

async function loadParticipants() {
  // For "PRESENT" filter, load all and filter client-side (PRESENT includes SIGNED)
  const apiStatus = statusFilter.value === 'PRESENT' ? undefined : statusFilter.value
  await participantsStore.fetchParticipants(slug, { search: search.value || undefined, status: apiStatus, limit: 500 })
}

const filteredParticipants = computed(() => {
  if (statusFilter.value === 'PRESENT') {
    return participantsStore.participants.filter(p => p.status === 'PRESENT' || p.status === 'SIGNED')
  }
  return participantsStore.participants
})

function setFilter(val: string | undefined) { statusFilter.value = val; loadParticipants() }
function onSearch() { loadParticipants() }

function statusSeverity(s: string) { return s === 'ABSENT' ? 'secondary' : s === 'PRESENT' ? 'info' : 'success' }
function statusLabel(s: string) { return s === 'ABSENT' ? 'Absent' : s === 'PRESENT' ? 'Present' : 'Present + Signe' }

function openEdit(p: any) { editParticipant.value = p; editData.value = { ...(p.data || {}) }; showEdit.value = true }

async function saveEdit() {
  try {
    await api.put(`/events/${slug}/participants/${editParticipant.value.id}`, { data: editData.value })
    showEdit.value = false
    loadParticipants()
    toast.add({ severity: 'success', summary: 'Sauvegarde', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  }
}

async function downloadPdf(id: string) {
  try {
    const res = await api.get(`/events/${slug}/participants/${id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank')
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur de telechargement', life: 3000 })
  }
}

async function setStatus(id: string, status: string) {
  try {
    await api.post(`/events/${slug}/participants/${id}/status`, { status })
    loadParticipants()
    toast.add({ severity: 'success', summary: status === 'PRESENT' ? 'Marque present' : status === 'ABSENT' ? 'Marque absent' : 'Statut mis a jour', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  }
}

function confirmReset(p: any) {
  resetTarget.value = p
  showResetConfirm.value = true
}

async function executeReset() {
  if (resetTarget.value) {
    await setStatus(resetTarget.value.id, 'PRESENT')
  }
  showResetConfirm.value = false
  resetTarget.value = null
}

function confirmDelete(p: any) {
  deleteTarget.value = p
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    await api.delete(`/events/${slug}/participants/${deleteTarget.value.id}`)
    loadParticipants()
    toast.add({ severity: 'success', summary: 'Participant supprime', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  } finally {
    showDeleteConfirm.value = false
    deleteTarget.value = null
  }
}

function openCreate() {
  newParticipant.value = {}
  // Pre-fill QR code field with auto-generated value
  const qrField = fields.value.find((f: any) => f.isQrField)
  if (qrField) newParticipant.value[qrField.key] = 'QR-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  showCreate.value = true
}

async function createParticipant() {
  const qrField = fields.value.find((f: any) => f.isQrField)
  const qrCode = qrField ? newParticipant.value[qrField.key] : newParticipant.value['qr_code']
  if (!qrCode) { toast.add({ severity: 'error', summary: 'Le code QR est requis', life: 3000 }); return }
  try {
    await api.post(`/events/${slug}/participants`, { qrCode, data: newParticipant.value })
    showCreate.value = false
    loadParticipants()
    toast.add({ severity: 'success', summary: 'Participant cree', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e?.response?.data?.message, life: 3000 })
  }
}

async function sendEmail(id: string) {
  try {
    await api.post(`/events/${slug}/participants/${id}/email`)
    toast.add({ severity: 'success', summary: 'Email envoye', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: "Erreur d'envoi", life: 3000 })
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Participants</h1>
      <Button label="Ajouter" icon="pi pi-plus" size="small" @click="openCreate" />
    </div>

    <!-- Status filter tabs with counts -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <Button v-for="tab in tabs" :key="tab.label"
        :label="`${tab.label} (${tab.value ? counts[tab.value] || 0 : counts.all})`"
        :severity="statusFilter === tab.value ? undefined : 'secondary'"
        size="small" @click="setFilter(tab.value)"
      />
    </div>

    <InputText v-model="search" placeholder="Rechercher..." class="w-full mb-4" @keyup.enter="onSearch" />

    <DataTable :value="filteredParticipants" :loading="participantsStore.isLoading" rowHover
      :paginator="true" :rows="20" :rowsPerPageOptions="[10, 20, 50, 100]"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
      currentPageReportTemplate="{first} - {last} sur {totalRecords}"
    >
      <Column v-for="f in displayFields" :key="f.key" :header="f.label" :sortable="true">
        <template #body="{ data }">{{ data.data?.[f.key] || '' }}</template>
      </Column>
      <Column header="Statut" :sortable="true" sortField="status">
        <template #body="{ data }">
          <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column header="Actions" style="width: 200px">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button icon="pi pi-pencil" severity="secondary" text size="small" title="Modifier" @click="openEdit(data)" />
            <Button v-if="data.status === 'ABSENT'" icon="pi pi-check" severity="success" text size="small" title="Marquer present" @click="setStatus(data.id, 'PRESENT')" />
            <Button v-if="data.status === 'PRESENT'" icon="pi pi-times" severity="warn" text size="small" title="Marquer absent" @click="setStatus(data.id, 'ABSENT')" />
            <Button v-if="data.status === 'SIGNED'" icon="pi pi-download" severity="info" text size="small" title="Telecharger PDF" @click="downloadPdf(data.id)" />
            <Button v-if="data.status === 'SIGNED'" icon="pi pi-envelope" severity="secondary" text size="small" title="Envoyer email" @click="sendEmail(data.id)" />
            <Button v-if="data.status === 'SIGNED'" icon="pi pi-refresh" severity="danger" text size="small" title="Reinitialiser le statut" @click="confirmReset(data)" />
            <Button icon="pi pi-trash" severity="danger" text size="small" title="Supprimer" @click="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Edit dialog -->
    <Dialog v-model:visible="showEdit" header="Modifier le participant" modal class="w-full max-w-lg">
      <div v-if="editParticipant" class="space-y-3 p-2">
        <div v-for="f in fields" :key="f.key">
          <label class="text-sm font-medium">{{ f.label }}</label>
          <InputText v-model="editData[f.key]" class="w-full mt-1" :disabled="!f.editable" />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showEdit = false" />
        <Button label="Sauvegarder" icon="pi pi-check" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- Reset confirmation dialog -->
    <Dialog v-model:visible="showResetConfirm" header="Confirmer la reinitialisation" modal class="w-full max-w-sm">
      <div class="p-2">
        <p>Reinitialiser le statut de ce participant a <strong>Present</strong> ?</p>
        <p class="text-sm text-red-600 mt-2">Le PDF signe et la date de signature seront supprimes.</p>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showResetConfirm = false" />
        <Button label="Reinitialiser" icon="pi pi-refresh" severity="danger" @click="executeReset" />
      </template>
    </Dialog>

    <!-- Create participant dialog -->
    <Dialog v-model:visible="showCreate" header="Ajouter un participant" modal class="w-full max-w-lg">
      <div class="space-y-3 p-2">
        <div v-for="f in fields" :key="f.key">
          <label class="text-sm font-medium">{{ f.label }} <span v-if="f.required || f.isQrField" class="text-red-500">*</span></label>
          <select v-if="f.type === 'SELECT'" v-model="newParticipant[f.key]" class="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1">
            <option value="">—</option>
            <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <InputText v-else v-model="newParticipant[f.key]" class="w-full mt-1" :type="f.type === 'EMAIL' ? 'email' : f.type === 'TEL' ? 'tel' : f.type === 'DATE' ? 'date' : f.type === 'NUMBER' ? 'number' : 'text'" />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showCreate = false" />
        <Button label="Creer" icon="pi pi-check" @click="createParticipant" />
      </template>
    </Dialog>

    <!-- Delete confirmation -->
    <Dialog v-model:visible="showDeleteConfirm" header="Supprimer le participant" modal class="w-full max-w-sm">
      <div v-if="deleteTarget" class="p-2">
        <p>Supprimer <strong>{{ deleteTarget.data?.prenom }} {{ deleteTarget.data?.nom }}</strong> ?</p>
        <p class="text-sm text-red-600 mt-2">Cette action est irreversible. Les signatures associees seront egalement supprimees.</p>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showDeleteConfirm = false" />
        <Button label="Supprimer" icon="pi pi-trash" severity="danger" @click="executeDelete" />
      </template>
    </Dialog>
  </div>
</template>
