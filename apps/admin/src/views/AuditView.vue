<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import api from '../lib/axios'

const logs = ref<any[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get('/audit?limit=200')
    logs.value = data
  } catch {}
  finally { isLoading.value = false }
})

function actionSeverity(action: string) {
  switch (action) {
    case 'LOGIN': return 'info'
    case 'SCAN': return 'secondary'
    case 'SIGN': return 'success'
    case 'EXPORT': return 'warn'
    default: return 'secondary'
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Journal d'audit</h1>
    <DataTable :value="logs" :loading="isLoading" rowHover
      :paginator="true" :rows="50" :rowsPerPageOptions="[20, 50, 100]"
      currentPageReportTemplate="{first} - {last} sur {totalRecords}"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
    >
      <Column header="Date" :sortable="true" field="createdAt" style="width: 150px">
        <template #body="{ data }">
          <span class="text-xs">{{ new Date(data.createdAt).toLocaleString('fr-FR') }}</span>
        </template>
      </Column>
      <Column header="Action" :sortable="true" field="action" style="width: 100px">
        <template #body="{ data }">
          <Tag :value="data.action" :severity="actionSeverity(data.action)" />
        </template>
      </Column>
      <Column header="Utilisateur" field="userEmail">
        <template #body="{ data }">
          <span class="text-sm">{{ data.userEmail || '—' }}</span>
        </template>
      </Column>
      <Column header="Cible" field="targetLabel">
        <template #body="{ data }">
          <span class="text-sm font-medium">{{ data.targetLabel || '—' }}</span>
        </template>
      </Column>
      <Column header="Details" field="details">
        <template #body="{ data }">
          <span class="text-xs text-gray-500">{{ data.details || '' }}</span>
        </template>
      </Column>
      <Column header="Evenement" field="eventSlug">
        <template #body="{ data }">
          <span class="text-xs text-gray-400">{{ data.eventSlug || '' }}</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
