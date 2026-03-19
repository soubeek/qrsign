<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const configStore = useConfigStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    await configStore.loadConfig()
    const redirect = (route.query.redirect as string) || '/scanner'
    router.push(redirect)
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } }
    errorMessage.value = axiosErr.response?.data?.message || 'Identifiants incorrects'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
    <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800">QRSign</h1>
        <p class="text-gray-500 mt-2">Connexion a l'espace d'accueil</p>
      </div>

      <form @submit.prevent="handleLogin" class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <label for="email" class="text-sm font-medium text-gray-700">Adresse e-mail</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            placeholder="agent@mairie.fr"
            class="w-full"
            required
            autocomplete="email"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="password" class="text-sm font-medium text-gray-700">Mot de passe</label>
          <Password
            id="password"
            v-model="password"
            :feedback="false"
            toggleMask
            inputClass="w-full"
            class="w-full"
            placeholder="Mot de passe"
            required
          />
        </div>

        <div v-if="errorMessage" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {{ errorMessage }}
        </div>

        <Button
          type="submit"
          label="Se connecter"
          icon="pi pi-sign-in"
          :loading="auth.isLoading"
          class="w-full"
          severity="primary"
        />
      </form>
    </div>
  </div>
</template>
