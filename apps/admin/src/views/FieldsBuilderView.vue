<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFieldsStore } from '../stores/fields.store'
import draggable from 'vuedraggable'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import ToggleSwitch from 'primevue/toggleswitch'
import Chips from 'primevue/chips'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const router = useRouter()
const fieldsStore = useFieldsStore()
const toast = useToast()
const slug = route.params.slug as string
const showEditor = ref(false)
const editingField = ref<any>(null)
const isNew = ref(false)

const fieldTypes = [
  { label: 'Texte', value: 'TEXT', icon: 'pi-align-left' },
  { label: 'Email', value: 'EMAIL', icon: 'pi-at' },
  { label: 'Téléphone', value: 'TEL', icon: 'pi-phone' },
  { label: 'Date', value: 'DATE', icon: 'pi-calendar' },
  { label: 'Liste', value: 'SELECT', icon: 'pi-list' },
  { label: 'Zone de texte', value: 'TEXTAREA', icon: 'pi-align-justify' },
  { label: 'Nombre', value: 'NUMBER', icon: 'pi-hashtag' },
]

onMounted(() => fieldsStore.fetchFields(slug))

function addField() {
  editingField.value = { key: '', label: '', type: 'TEXT', options: [], required: false, editable: true, displayInList: false, isQrField: false, isEmailField: false }
  isNew.value = true; showEditor.value = true
}

function editField(f: any) { editingField.value = { ...f }; isNew.value = false; showEditor.value = true }

function slugifyKey() {
  if (isNew.value && editingField.value) {
    editingField.value.key = editingField.value.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }
}

async function saveField() {
  try {
    if (isNew.value) { await fieldsStore.createField(slug, editingField.value) }
    else { await fieldsStore.updateField(slug, editingField.value.id, editingField.value) }
    showEditor.value = false
    toast.add({ severity: 'success', summary: 'Sauvegardé', life: 2000 })
  } catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
}

async function deleteField(id: string) {
  if (!confirm('Supprimer ce champ ?')) return
  try { await fieldsStore.deleteField(slug, id) } catch {}
}

async function onDragEnd() {
  const items = fieldsStore.fields.map((f: any, i: number) => ({ id: f.id, displayOrder: i }))
  await fieldsStore.reorderFields(slug, items)
}

function typeIcon(type: string) { return fieldTypes.find(t => t.value === type)?.icon || 'pi-question' }
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push(`/events/${slug}/config`)" />
      <h1 class="text-2xl font-bold">Constructeur de champs</h1>
      <Button label="Ajouter" icon="pi pi-plus" class="ml-auto" @click="addField" />
    </div>
    <draggable :list="fieldsStore.fields" item-key="id" handle=".drag-handle" @end="onDragEnd" class="space-y-2">
      <template #item="{ element }">
        <div class="bg-white rounded-lg shadow-sm p-3 flex items-center gap-3 border">
          <i class="pi pi-bars drag-handle cursor-move text-gray-400"></i>
          <i :class="'pi ' + typeIcon(element.type)" class="text-blue-600"></i>
          <div class="flex-1 min-w-0">
            <span class="font-medium">{{ element.label }}</span>
            <code class="ml-2 text-xs text-gray-400 bg-gray-100 px-1 rounded">{{ element.key }}</code>
          </div>
          <Tag v-if="element.required" value="requis" severity="danger" class="text-xs" />
          <Tag v-if="element.isQrField" value="QR" severity="info" class="text-xs" />
          <Tag v-if="element.isEmailField" value="email" severity="warn" class="text-xs" />
          <Button icon="pi pi-pencil" severity="secondary" text size="small" @click="editField(element)" />
          <Button icon="pi pi-trash" severity="danger" text size="small" @click="deleteField(element.id)" />
        </div>
      </template>
    </draggable>
    <Dialog v-model:visible="showEditor" :header="isNew ? 'Ajouter un champ' : 'Modifier le champ'" modal class="w-full max-w-md">
      <div v-if="editingField" class="space-y-4 p-2">
        <div><label class="text-sm font-medium">Label</label><InputText v-model="editingField.label" class="w-full mt-1" @input="slugifyKey" /></div>
        <div><label class="text-sm font-medium">Clé</label><InputText v-model="editingField.key" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Type</label><Dropdown v-model="editingField.type" :options="fieldTypes" optionLabel="label" optionValue="value" class="w-full mt-1" /></div>
        <div v-if="editingField.type === 'SELECT'"><label class="text-sm font-medium">Options</label><Chips v-model="editingField.options" class="w-full mt-1" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center gap-2"><ToggleSwitch v-model="editingField.required" /><span class="text-sm">Requis</span></div>
          <div class="flex items-center gap-2"><ToggleSwitch v-model="editingField.editable" /><span class="text-sm">Éditable</span></div>
          <div class="flex items-center gap-2"><ToggleSwitch v-model="editingField.displayInList" /><span class="text-sm">Afficher en liste</span></div>
          <div class="flex items-center gap-2"><ToggleSwitch v-model="editingField.isQrField" /><span class="text-sm">Champ QR</span></div>
          <div class="flex items-center gap-2"><ToggleSwitch v-model="editingField.isEmailField" /><span class="text-sm">Champ email</span></div>
        </div>
      </div>
      <template #footer><Button label="Sauvegarder" icon="pi pi-check" @click="saveField" /><Button label="Annuler" severity="secondary" text @click="showEditor = false" /></template>
    </Dialog>
  </div>
</template>
