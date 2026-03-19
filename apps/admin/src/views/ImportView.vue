<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const route = useRoute()
const toast = useToast()
const slug = route.params.slug as string
const file = ref<File | null>(null)
const preview = ref<string[][]>([])
const headers = ref<string[]>([])
const result = ref<any>(null)
const isImporting = ref(false)
const isDragOver = ref(false)

function handleFile(f: File) {
  file.value = f
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    const sep = lines[0].includes(';') ? ';' : ','
    headers.value = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
    preview.value = lines.slice(1, 6).map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')))
  }
  reader.readAsText(f)
}

function onDrop(e: DragEvent) { isDragOver.value = false; if (e.dataTransfer?.files[0]) handleFile(e.dataTransfer.files[0]) }
function onFileInput(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f) }

async function doImport() {
  if (!file.value) return
  isImporting.value = true; result.value = null
  try {
    const formData = new FormData()
    formData.append('file', file.value)
    const { data } = await api.post(`/events/${slug}/participants/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    result.value = data
    toast.add({ severity: 'success', summary: `${data.created} créés, ${data.updated} mis à jour`, life: 5000 })
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 5000 }) }
  finally { isImporting.value = false }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Importer des participants</h1>
    <div class="border-2 border-dashed rounded-xl p-12 text-center mb-6 transition-colors" :class="isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'" @dragover.prevent="isDragOver = true" @dragleave="isDragOver = false" @drop.prevent="onDrop">
      <i class="pi pi-upload text-4xl text-gray-400 mb-4"></i>
      <p class="text-gray-600 mb-3">Glissez un fichier CSV ici</p>
      <label class="cursor-pointer text-blue-600 hover:underline">
        ou sélectionnez un fichier
        <input type="file" accept=".csv" class="hidden" @change="onFileInput" />
      </label>
      <p v-if="file" class="mt-3 text-sm text-green-600">{{ file.name }}</p>
    </div>
    <div v-if="headers.length > 0" class="mb-6">
      <h2 class="font-semibold mb-3">Aperçu (5 premières lignes)</h2>
      <DataTable :value="preview" class="text-sm">
        <Column v-for="(h, i) in headers" :key="i" :header="h"><template #body="{ data }">{{ data[i] || '' }}</template></Column>
      </DataTable>
      <Button label="Importer" icon="pi pi-upload" class="mt-4" :loading="isImporting" @click="doImport" />
    </div>
    <div v-if="result" class="bg-white rounded-xl shadow p-6">
      <h2 class="font-semibold mb-3">Résultat</h2>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="text-center"><div class="text-2xl font-bold text-green-600">{{ result.created }}</div><div class="text-sm text-gray-500">Créés</div></div>
        <div class="text-center"><div class="text-2xl font-bold text-blue-600">{{ result.updated }}</div><div class="text-sm text-gray-500">Mis à jour</div></div>
      </div>
      <div v-if="result.errors?.length > 0" class="mt-4">
        <h3 class="font-medium text-red-600 mb-2">Erreurs ({{ result.errors.length }})</h3>
        <ul class="text-sm text-red-600 list-disc list-inside"><li v-for="(e, i) in result.errors" :key="i">{{ e }}</li></ul>
      </div>
    </div>
  </div>
</template>
