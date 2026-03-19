<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import api from '@/lib/axios'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const configStore = useConfigStore()

const email = ref(localStorage.getItem('qrsign_last_email') || '')
const password = ref('')
const errorMessage = ref('')
const operators = ref<any[]>([])
const selectedOperator = ref<any>(null)
const isLoadingOperators = ref(false)
const passwordInput = ref<any>(null)

// Load operators for quick select
onMounted(async () => {
  const slug = configStore.slug || import.meta.env.VITE_EVENT_SLUG || 'conseil-municipal'
  isLoadingOperators.value = true
  try {
    const { data } = await api.get(`/events/${slug}/operators`)
    operators.value = data || []
  } catch {}
  finally { isLoadingOperators.value = false }
})

function selectOperator(op: any) {
  selectedOperator.value = op
  email.value = op.email
  password.value = ''
  // Focus password field
  setTimeout(() => {
    const input = document.querySelector('#password input') as HTMLInputElement
    input?.focus()
  }, 100)
}

function getInitials(op: any): string {
  return ((op.firstName || '').charAt(0) + (op.lastName || '').charAt(0)).toUpperCase()
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Administrateur'
    case 'ADMIN': return 'Gestionnaire'
    case 'OPERATOR': return 'Operateur'
    case 'VIEWER': return 'Observateur'
    default: return role
  }
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500',
  ADMIN: 'bg-amber-500',
  OPERATOR: 'bg-blue-500',
  VIEWER: 'bg-gray-400',
}

async function handleLogin() {
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    localStorage.setItem('qrsign_last_email', email.value)
    await configStore.loadConfig()
    const redirect = (route.query.redirect as string) || '/scanner'
    router.push(redirect)
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } }
    errorMessage.value = axiosErr.response?.data?.message || 'Identifiants incorrects'
    password.value = ''
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
    <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">QRSign</h1>
        <p class="text-gray-500 mt-2">Connexion a l'espace d'accueil</p>
      </div>

      <!-- Quick select operators -->
      <div v-if="operators.length > 0" class="mb-6">
        <p class="text-sm text-gray-500 mb-3">Connexion rapide</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="op in operators" :key="op.id"
            class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
            :class="selectedOperator?.id === op.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
            @click="selectOperator(op)"
          >
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              :class="roleColors[op.role] || 'bg-gray-400'"
            >
              {{ getInitials(op) }}
            </div>
            <div class="min-w-0">
              <div class="font-medium text-sm truncate">{{ op.firstName }} {{ op.lastName }}</div>
              <div class="text-xs text-gray-400">{{ getRoleLabel(op.role) }}</div>
            </div>
          </button>
        </div>
      </div>

      <div v-if="operators.length > 0" class="relative mb-4">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200"></div></div>
        <div class="relative flex justify-center text-xs"><span class="px-2 bg-white text-gray-400">ou saisie manuelle</span></div>
      </div>

      <form @submit.prevent="handleLogin" class="flex flex-col gap-4">
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
            ref="passwordInput"
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
        />
      </form>
    </div>
  </div>
</template>
