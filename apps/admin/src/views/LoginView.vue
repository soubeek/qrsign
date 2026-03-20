<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')

async function login() {
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push('/events')
  } catch { error.value = 'Email ou mot de passe incorrect' }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <h1 class="text-2xl font-bold text-center mb-6">CheckFlow Administration</h1>
      <form @submit.prevent="login" class="space-y-4">
        <div><label class="text-sm font-medium text-gray-600">Email</label><InputText v-model="email" type="email" class="w-full mt-1" /></div>
        <div><label class="text-sm font-medium text-gray-600">Mot de passe</label><Password v-model="password" :feedback="false" toggleMask class="w-full mt-1" inputClass="w-full" /></div>
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        <Button type="submit" label="Se connecter" icon="pi pi-sign-in" class="w-full" :loading="auth.isLoading" />
      </form>
    </div>
  </div>
</template>
