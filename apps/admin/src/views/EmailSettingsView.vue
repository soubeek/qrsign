<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Password from 'primevue/password'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const router = useRouter()
const toast = useToast()
const form = ref<any>({ smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', fromAddress: '', fromName: '', autoSendOnSign: false, allowManualSend: true, subject: 'Votre document signe', bodyTemplate: '' })
const showTest = ref(false)
const testAddress = ref('')

const variables = ['{{participantName}}', '{{eventTitle}}', '{{signedAt}}', '{{organizationName}}']

onMounted(async () => {
  try {
    const { data } = await api.get('/email-config')
    if (data) form.value = { ...form.value, ...data }
  } catch {}
})

async function save() {
  try {
    await api.put('/email-config', form.value)
    toast.add({ severity: 'success', summary: 'Configuration email sauvegardee', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', life: 3000 })
  }
}

async function sendTest() {
  try {
    await api.post('/email-config/test', { toAddress: testAddress.value })
    toast.add({ severity: 'success', summary: 'Email de test envoye', life: 3000 })
    showTest.value = false
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Erreur SMTP', detail: e?.response?.data?.message || e.message, life: 5000 })
  }
}

function insertVar(v: string) { form.value.bodyTemplate += v }
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Configuration email globale</h1>
    <div class="bg-white rounded-xl shadow p-6 space-y-6 max-w-3xl">
      <h2 class="font-semibold text-lg">Serveur SMTP</h2>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-sm font-medium">Hote SMTP</label><InputText v-model="form.smtpHost" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Port</label><InputNumber v-model="form.smtpPort" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Utilisateur</label><InputText v-model="form.smtpUser" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Mot de passe</label><Password v-model="form.smtpPass" :feedback="false" toggleMask class="w-full mt-1" inputClass="w-full" /></div>
      </div>
      <div class="flex items-center gap-2"><ToggleSwitch v-model="form.smtpSecure" /><span class="text-sm">Connexion securisee (SSL/TLS)</span></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-sm font-medium">Adresse expediteur</label><InputText v-model="form.fromAddress" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium">Nom expediteur</label><InputText v-model="form.fromName" class="w-full mt-1" /></div>
      </div>
      <h2 class="font-semibold text-lg pt-4">Comportement</h2>
      <div class="space-y-2">
        <div class="flex items-center gap-2"><ToggleSwitch v-model="form.autoSendOnSign" /><span class="text-sm">Envoyer automatiquement apres signature</span></div>
        <div class="flex items-center gap-2"><ToggleSwitch v-model="form.allowManualSend" /><span class="text-sm">Autoriser l'envoi manuel</span></div>
      </div>
      <h2 class="font-semibold text-lg pt-4">Template email</h2>
      <div><label class="text-sm font-medium">Sujet</label><InputText v-model="form.subject" class="w-full mt-1" /></div>
      <div>
        <label class="text-sm font-medium">Corps du message</label>
        <div class="flex flex-wrap gap-1 mt-1 mb-2">
          <button v-for="v in variables" :key="v" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200" @click="insertVar(v)">{{ v }}</button>
        </div>
        <Textarea v-model="form.bodyTemplate" rows="6" class="w-full" />
      </div>
      <div class="flex gap-3">
        <Button label="Sauvegarder" icon="pi pi-check" @click="save" />
        <Button label="Envoyer un test" icon="pi pi-send" severity="secondary" @click="showTest = true" />
      </div>
    </div>
    <Dialog v-model:visible="showTest" header="Email de test" modal class="w-full max-w-sm">
      <div class="p-2"><label class="text-sm font-medium">Adresse de test</label><InputText v-model="testAddress" class="w-full mt-1" type="email" /></div>
      <template #footer><Button label="Envoyer" icon="pi pi-send" @click="sendTest" /></template>
    </Dialog>
  </div>
</template>
