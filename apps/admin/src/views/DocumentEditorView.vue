<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const slug = route.params.slug as string

// State
const documents = ref<any[]>([])
const selectedDocId = ref<string | null>(null)
const fields = ref<any[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const isPreviewing = ref(false)
const showDeleteConfirm = ref(false)
const deleteTargetId = ref<string | null>(null)

// Current document being edited
const doc = ref<any>(null)
const originalDoc = ref<string>('')

const hasChanges = computed(() => doc.value && JSON.stringify(doc.value) !== originalDoc.value)
const declCharCount = computed(() => doc.value?.declarationTemplate?.length || 0)

// Active section for collapsible notice sections
const activeSection = ref<number | null>(null)
const activeInsertTarget = ref<'declaration' | number>('declaration')
const declTextarea = ref<HTMLTextAreaElement | null>(null)
const sectionRefs: Record<number, HTMLTextAreaElement> = {}

// Logo/background previews
const logoPreview = ref<string | null>(null)
const backgroundPreview = ref<string | null>(null)
const isUploadingLogo = ref(false)
const isUploadingBg = ref(false)

// Preview of declaration with sample data
const declarationPreview = computed(() => {
  if (!doc.value?.declarationTemplate) return ''
  let text = doc.value.declarationTemplate
  for (const f of fields.value) {
    const sample = f.key === 'nom' ? 'DUPONT' : f.key === 'prenom' ? 'Jean' : f.key === 'civilite' ? 'M.' : f.key === 'commune' ? 'Saint-Paul' : `[${f.label}]`
    text = text.replace(new RegExp(`\\{${f.key}\\}`, 'g'), sample)
  }
  text = text.replace('{signedAt}', new Date().toLocaleDateString('fr-FR'))
  return text
})

// Load all documents
onMounted(async () => {
  try {
    const [docsRes, fieldsRes] = await Promise.all([
      api.get(`/events/${slug}/document`),
      api.get(`/events/${slug}/fields`),
    ])
    documents.value = docsRes.data || []
    fields.value = fieldsRes.data || []
    // Select first document by default
    if (documents.value.length > 0) selectDocument(documents.value[0].id)
  } catch {}
  finally { isLoading.value = false }
})

function selectDocument(docId: string) {
  const d = documents.value.find(x => x.id === docId)
  if (!d) return
  selectedDocId.value = docId
  doc.value = { ...d }
  originalDoc.value = JSON.stringify(doc.value)
  logoPreview.value = null
  backgroundPreview.value = null
  loadAssetPreviews()
}

async function loadAssetPreviews() {
  if (!selectedDocId.value) return
  if (doc.value?.logoPath) {
    try {
      const res = await api.get(`/events/${slug}/document/${selectedDocId.value}/asset/logo`, { responseType: 'blob' })
      logoPreview.value = URL.createObjectURL(res.data)
    } catch {}
  }
  if (doc.value?.backgroundPath) {
    try {
      const res = await api.get(`/events/${slug}/document/${selectedDocId.value}/asset/background`, { responseType: 'blob' })
      backgroundPreview.value = URL.createObjectURL(res.data)
    } catch {}
  }
}

async function createDocument() {
  try {
    const { data } = await api.post(`/events/${slug}/document`, { title: 'Nouveau document' })
    documents.value.push(data)
    selectDocument(data.id)
    toast.add({ severity: 'success', summary: 'Document cree', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  }
}

async function saveDocument() {
  if (!selectedDocId.value || !doc.value) return
  isSaving.value = true
  try {
    const { data } = await api.put(`/events/${slug}/document/${selectedDocId.value}`, doc.value)
    // Update in list
    const idx = documents.value.findIndex(d => d.id === selectedDocId.value)
    if (idx !== -1) documents.value[idx] = data
    doc.value = { ...data }
    originalDoc.value = JSON.stringify(doc.value)
    toast.add({ severity: 'success', summary: 'Sauvegarde', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  } finally { isSaving.value = false }
}

function confirmDelete(docId: string) {
  deleteTargetId.value = docId
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTargetId.value) return
  try {
    await api.delete(`/events/${slug}/document/${deleteTargetId.value}`)
    documents.value = documents.value.filter(d => d.id !== deleteTargetId.value)
    if (selectedDocId.value === deleteTargetId.value) {
      if (documents.value.length > 0) selectDocument(documents.value[0].id)
      else { selectedDocId.value = null; doc.value = null }
    }
    toast.add({ severity: 'success', summary: 'Document supprime', life: 2000 })
  } catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
  finally { showDeleteConfirm.value = false; deleteTargetId.value = null }
}

async function moveDocument(docId: string, direction: -1 | 1) {
  const idx = documents.value.findIndex(d => d.id === docId)
  const target = idx + direction
  if (target < 0 || target >= documents.value.length) return
  const temp = documents.value[idx]
  documents.value[idx] = documents.value[target]
  documents.value[target] = temp
  // Save new order
  const items = documents.value.map((d, i) => ({ id: d.id, displayOrder: i }))
  try { await api.post(`/events/${slug}/document/reorder`, { items }) }
  catch {}
}

async function previewPdf() {
  if (!selectedDocId.value) return
  isPreviewing.value = true
  try {
    if (hasChanges.value) await saveDocument()
    const res = await api.post(`/events/${slug}/document/${selectedDocId.value}/preview`, {}, { responseType: 'blob' })
    window.open(URL.createObjectURL(res.data), '_blank')
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e?.response?.data?.message || e.message, life: 3000 })
  } finally { isPreviewing.value = false }
}

// Notice sections management
function addSection() { if (doc.value) { doc.value.noticeSections.push({ title: '', content: '', align: 'left' }); activeSection.value = doc.value.noticeSections.length - 1 } }
function removeSection(i: number) { doc.value?.noticeSections.splice(i, 1); if (activeSection.value === i) activeSection.value = null }
function moveSectionUp(i: number) { if (i > 0 && doc.value) { const s = doc.value.noticeSections; [s[i], s[i-1]] = [s[i-1], s[i]]; activeSection.value = i - 1 } }
function moveSectionDown(i: number) { if (doc.value && i < doc.value.noticeSections.length - 1) { const s = doc.value.noticeSections; [s[i], s[i+1]] = [s[i+1], s[i]]; activeSection.value = i + 1 } }

function wrapSelection(sectionIndex: number, marker: string) {
  const el = sectionRefs[sectionIndex]
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const text = doc.value.noticeSections[sectionIndex].content || ''
  const selected = text.substring(start, end)
  if (selected) {
    doc.value.noticeSections[sectionIndex].content = text.substring(0, start) + marker + selected + marker + text.substring(end)
  } else {
    doc.value.noticeSections[sectionIndex].content = text.substring(0, start) + marker + 'texte' + marker + text.substring(end)
  }
  requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + marker.length + (selected || 'texte').length + marker.length })
}

function insertBullet(sectionIndex: number) {
  const el = sectionRefs[sectionIndex]
  const text = doc.value.noticeSections[sectionIndex].content || ''
  const pos = el?.selectionStart ?? text.length
  const before = text.substring(0, pos)
  const after = text.substring(pos)
  const prefix = before.endsWith('\n') || before === '' ? '' : '\n'
  doc.value.noticeSections[sectionIndex].content = before + prefix + '- ' + after
  requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = pos + prefix.length + 2 } })
}

function insertVariable(key: string) {
  if (!doc.value) return
  if (activeInsertTarget.value === 'declaration') {
    doc.value.declarationTemplate = (doc.value.declarationTemplate || '') + `{${key}}`
  } else {
    const idx = activeInsertTarget.value as number
    const section = doc.value.noticeSections[idx]
    if (section) section.content = (section.content || '') + `{${key}}`
  }
}

// Asset upload
async function uploadAsset(type: 'logo' | 'background', event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selectedDocId.value) return
  const isLogo = type === 'logo'
  if (isLogo) isUploadingLogo.value = true; else isUploadingBg.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data: result } = await api.post(`/events/${slug}/document/${selectedDocId.value}/upload-${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    const reader = new FileReader()
    reader.onload = () => {
      if (isLogo) { logoPreview.value = reader.result as string; doc.value.logoPath = result.path }
      else { backgroundPreview.value = reader.result as string; doc.value.backgroundPath = result.path }
    }
    reader.readAsDataURL(file)
    toast.add({ severity: 'success', summary: `${isLogo ? 'Logo' : 'Fond'} telecharge`, life: 2000 })
  } catch { toast.add({ severity: 'error', summary: 'Erreur', life: 3000 }) }
  finally { if (isLogo) isUploadingLogo.value = false; else isUploadingBg.value = false }
}

async function removeAsset(type: 'logo' | 'background') {
  if (!selectedDocId.value) return
  try {
    await api.post(`/events/${slug}/document/${selectedDocId.value}/remove-${type}`)
    if (type === 'logo') { logoPreview.value = null; doc.value.logoPath = null }
    else { backgroundPreview.value = null; doc.value.backgroundPath = null }
  } catch {}
}

// Warn before unload
function onBeforeUnload(e: BeforeUnloadEvent) { if (hasChanges.value) { e.preventDefault(); e.returnValue = '' } }
watch(hasChanges, v => {
  if (v) window.addEventListener('beforeunload', onBeforeUnload)
  else window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text @click="router.push(`/events/${slug}/config`)" />
      <h1 class="text-2xl font-bold flex-1">Documents a signer</h1>
      <span v-if="hasChanges" class="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Modifications non sauvegardees</span>
    </div>

    <div v-if="isLoading" class="text-center py-12"><i class="pi pi-spin pi-spinner text-2xl text-gray-400"></i></div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Left: Document list -->
      <div class="lg:col-span-1 space-y-3">
        <Button label="Ajouter un document" icon="pi pi-plus" class="w-full" size="small" @click="createDocument" />

        <div v-for="d in documents" :key="d.id"
          class="p-3 rounded-lg border cursor-pointer transition-all"
          :class="selectedDocId === d.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'"
          @click="selectDocument(d.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">{{ d.title }}</p>
              <div class="flex gap-1 mt-1">
                <Tag v-if="d.required" value="requis" severity="warn" class="text-xs" />
                <Tag v-else value="optionnel" severity="secondary" class="text-xs" />
              </div>
            </div>
            <div class="flex flex-col gap-0.5 shrink-0">
              <Button icon="pi pi-arrow-up" severity="secondary" text size="small" class="!p-1 !w-6 !h-6" :disabled="documents.indexOf(d) === 0" @click.stop="moveDocument(d.id, -1)" />
              <Button icon="pi pi-arrow-down" severity="secondary" text size="small" class="!p-1 !w-6 !h-6" :disabled="documents.indexOf(d) === documents.length - 1" @click.stop="moveDocument(d.id, 1)" />
            </div>
          </div>
          <div class="mt-2 flex gap-1">
            <Button icon="pi pi-trash" severity="danger" text size="small" class="!p-1" @click.stop="confirmDelete(d.id)" />
          </div>
        </div>

        <div v-if="documents.length === 0" class="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
          <i class="pi pi-file-plus text-2xl mb-2"></i>
          <p class="text-sm">Aucun document</p>
        </div>
      </div>

      <!-- Right: Editor -->
      <div v-if="doc" class="lg:col-span-3 space-y-6">
        <!-- Title & settings -->
        <div class="bg-white rounded-xl shadow p-6">
          <h2 class="font-semibold mb-4 flex items-center gap-2"><i class="pi pi-file-edit text-blue-600"></i> {{ doc.title }}</h2>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div><label class="text-sm font-medium">Titre</label><InputText v-model="doc.title" class="w-full mt-1" /></div>
            <div><label class="text-sm font-medium">Label du bouton</label><InputText v-model="doc.signingLabel" class="w-full mt-1" /></div>
          </div>
          <!-- Title position -->
          <div class="mb-4">
            <label class="text-sm font-medium mb-1 block">Position du titre dans le PDF</label>
            <div class="flex gap-1">
              <button v-for="pos in [{v:'left',icon:'pi-align-left',l:'Gauche'},{v:'center',icon:'pi-align-center',l:'Centre'},{v:'right',icon:'pi-align-right',l:'Droite'}]" :key="pos.v"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="doc.titlePosition === pos.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                @click="doc.titlePosition = pos.v"
              ><i :class="'pi ' + pos.icon" class="text-xs"></i> {{ pos.l }}</button>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2"><ToggleSwitch v-model="doc.required" /><span class="text-sm">Document requis</span></div>
          </div>
        </div>

        <!-- Logo & Background -->
        <div class="bg-white rounded-xl shadow p-6">
          <h2 class="font-semibold mb-4 flex items-center gap-2"><i class="pi pi-image text-blue-600"></i> Logo et fond</h2>
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="text-sm font-medium mb-2 block">Logo</label>
              <div v-if="logoPreview" class="mb-2 p-3 bg-gray-50 rounded text-center border">
                <img :src="logoPreview" alt="Logo" class="max-h-12 mx-auto" />
              </div>
              <div class="flex gap-2 items-center">
                <label class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50">
                  <i class="pi pi-upload text-xs"></i> {{ logoPreview ? 'Changer' : 'Ajouter' }}
                  <input type="file" accept="image/png,image/jpeg" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)" @change="uploadAsset('logo', $event)" />
                </label>
                <Button v-if="logoPreview" icon="pi pi-trash" severity="danger" text size="small" @click="removeAsset('logo')" />
              </div>
              <div v-if="logoPreview" class="mt-2 flex gap-1">
                <button v-for="pos in [{v:'left',l:'G'},{v:'center',l:'C'},{v:'right',l:'D'}]" :key="pos.v"
                  class="px-2 py-1 rounded text-xs border"
                  :class="doc.logoPosition === pos.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'"
                  @click="doc.logoPosition = pos.v"
                >{{ pos.l }}</button>
              </div>
            </div>
            <div>
              <label class="text-sm font-medium mb-2 block">Fond (filigrane)</label>
              <div v-if="backgroundPreview" class="mb-2 p-3 bg-gray-50 rounded text-center border">
                <img :src="backgroundPreview" alt="Fond" class="max-h-12 mx-auto opacity-40" />
              </div>
              <div class="flex gap-2 items-center">
                <label class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50">
                  <i class="pi pi-upload text-xs"></i> {{ backgroundPreview ? 'Changer' : 'Ajouter' }}
                  <input type="file" accept="image/png,image/jpeg" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)" @change="uploadAsset('background', $event)" />
                </label>
                <Button v-if="backgroundPreview" icon="pi pi-trash" severity="danger" text size="small" @click="removeAsset('background')" />
              </div>
            </div>
          </div>
        </div>

        <!-- Notice Sections -->
        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold flex items-center gap-2"><i class="pi pi-list text-blue-600"></i> Sections notice ({{ doc.noticeSections?.length || 0 }})</h2>
            <Button label="Ajouter" icon="pi pi-plus" size="small" @click="addSection" />
          </div>
          <div v-if="!doc.noticeSections?.length" class="text-center py-6 text-gray-400 border-2 border-dashed rounded-lg text-sm">Aucune section</div>
          <div v-for="(s, i) in doc.noticeSections" :key="i" class="border rounded-lg mb-2 overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer" @click="activeSection = activeSection === i ? null : i">
              <i :class="activeSection === i ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-gray-400 text-xs"></i>
              <span class="flex-1 text-sm font-medium">{{ s.title || `Section ${i+1}` }}</span>
              <div class="flex gap-0.5" @click.stop>
                <Button icon="pi pi-arrow-up" severity="secondary" text size="small" class="!p-1" :disabled="i===0" @click="moveSectionUp(i)" />
                <Button icon="pi pi-arrow-down" severity="secondary" text size="small" class="!p-1" :disabled="i===doc.noticeSections.length-1" @click="moveSectionDown(i)" />
                <Button icon="pi pi-trash" severity="danger" text size="small" class="!p-1" @click="removeSection(i)" />
              </div>
            </div>
            <div v-if="activeSection === i" class="p-3 space-y-2">
              <InputText v-model="s.title" placeholder="Titre" class="w-full" />

              <!-- Alignment -->
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Alignement :</span>
                <div class="flex gap-0.5">
                  <button v-for="al in [{v:'left',icon:'pi-align-left'},{v:'center',icon:'pi-align-center'},{v:'right',icon:'pi-align-right'},{v:'justify',icon:'pi-align-justify'}]" :key="al.v"
                    class="p-1.5 rounded border text-xs" :class="(s.align || 'left') === al.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'"
                    @click="s.align = al.v"
                  ><i :class="'pi ' + al.icon"></i></button>
                </div>
              </div>

              <!-- Formatting toolbar -->
              <div class="flex flex-wrap items-center gap-1 border-b pb-2">
                <button class="px-2 py-1 rounded text-xs font-bold border border-gray-300 hover:bg-gray-100" title="Gras" @click="wrapSelection(i, '**')">G</button>
                <button class="px-2 py-1 rounded text-xs italic border border-gray-300 hover:bg-gray-100" title="Italique" @click="wrapSelection(i, '*')">I</button>
                <button class="px-2 py-1 rounded text-xs border border-gray-300 hover:bg-gray-100" title="Liste a puces" @click="insertBullet(i)">- Liste</button>
                <div class="w-px h-5 bg-gray-300 mx-1"></div>
                <button v-for="f in fields" :key="f.key" class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100" @click="activeInsertTarget=i; insertVariable(f.key)">{{"{"}}{{f.key}}{{"}"}}</button>
              </div>

              <textarea :ref="el => { if (el) sectionRefs[i] = el as HTMLTextAreaElement }" v-model="s.content" rows="5" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="Contenu... (utilisez **gras**, *italique*, - liste)" />
              <div class="text-xs text-gray-400">{{ (s.content || '').length }} car. | **gras** *italique* - liste</div>
            </div>
          </div>
        </div>

        <!-- Declaration -->
        <div class="bg-white rounded-xl shadow p-6">
          <h2 class="font-semibold mb-4 flex items-center gap-2"><i class="pi pi-align-left text-blue-600"></i> Declaration</h2>
          <div class="flex flex-wrap gap-1 mb-2">
            <button v-for="f in fields" :key="f.key" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200" @click="activeInsertTarget='declaration'; insertVariable(f.key)">{{"{"}}{{f.key}}{{"}"}}</button>
            <button class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200" @click="activeInsertTarget='declaration'; insertVariable('signedAt')">{signedAt}</button>
          </div>
          <Textarea ref="declTextarea" v-model="doc.declarationTemplate" rows="5" class="w-full font-mono text-sm" @focus="activeInsertTarget='declaration'" />
          <div class="text-right text-xs mt-1" :class="declCharCount > 500 ? 'text-amber-600' : 'text-gray-400'">{{ declCharCount }} car.</div>
        </div>

        <!-- PDF settings -->
        <div class="bg-white rounded-xl shadow p-6">
          <h2 class="font-semibold mb-4 flex items-center gap-2"><i class="pi pi-cog text-blue-600"></i> Parametres PDF</h2>
          <div class="space-y-4">
            <div><label class="text-sm font-medium">Pied de page</label><InputText v-model="doc.pdfFooterText" class="w-full mt-1" /></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="text-sm font-medium">Largeur signature (mm)</label><InputText v-model.number="doc.signatureWidthMm" type="number" class="w-full mt-1" /></div>
              <div><label class="text-sm font-medium">Hauteur signature (mm)</label><InputText v-model.number="doc.signatureHeightMm" type="number" class="w-full mt-1" /></div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 sticky bottom-0 bg-gray-50 py-4 border-t">
          <Button label="Sauvegarder" icon="pi pi-check" :loading="isSaving" @click="saveDocument" />
          <Button label="Previsualiser PDF" icon="pi pi-eye" severity="secondary" :loading="isPreviewing" @click="previewPdf" />
        </div>
      </div>

      <!-- No document selected -->
      <div v-else class="lg:col-span-3 flex items-center justify-center py-20 text-gray-400">
        <div class="text-center">
          <i class="pi pi-file text-4xl mb-3"></i>
          <p>Selectionnez ou creez un document</p>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <Dialog v-model:visible="showDeleteConfirm" header="Supprimer le document" modal class="w-full max-w-sm">
      <p class="p-2">Cette action est irreversible. Les signatures existantes pour ce document seront egalement supprimees.</p>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="showDeleteConfirm = false" />
        <Button label="Supprimer" icon="pi pi-trash" severity="danger" @click="executeDelete" />
      </template>
    </Dialog>
  </div>
</template>
