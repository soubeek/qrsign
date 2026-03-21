<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import Password from 'primevue/password'
import Button from 'primevue/button'
import api from '@/lib/axios'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const configStore = useConfigStore()

const password = ref('')
const errorMessage = ref('')
const operators = ref<any[]>([])
const selectedOperator = ref<any>(null)
const isLoadingOperators = ref(true)

onMounted(async () => {
  const slug = configStore.slug || import.meta.env.VITE_EVENT_SLUG || 'conseil-municipal'
  try {
    const { data } = await api.get(`/events/${slug}/operators`)
    operators.value = data || []
  } catch {}
  finally { isLoadingOperators.value = false }
})

function selectOperator(op: any) {
  selectedOperator.value = op
  password.value = ''
  errorMessage.value = ''
  setTimeout(() => {
    const input = document.querySelector('#password input') as HTMLInputElement
    input?.focus()
  }, 100)
}

function deselectOperator() {
  selectedOperator.value = null
  password.value = ''
  errorMessage.value = ''
}

function getInitials(op: any): string {
  return ((op.firstName || '').charAt(0) + (op.lastName || '').charAt(0)).toUpperCase()
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'ADMIN': return 'Gestionnaire'
    case 'OPERATOR': return 'Operateur'
    case 'VIEWER': return 'Observateur'
    default: return role
  }
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-amber-500',
  OPERATOR: 'bg-blue-500',
  VIEWER: 'bg-gray-400',
}

async function handleLogin() {
  if (!selectedOperator.value) return
  errorMessage.value = ''
  try {
    await auth.login(selectedOperator.value.email, password.value)
    await configStore.loadConfig()
    const redirect = (route.query.redirect as string) || '/scanner'
    router.push(redirect)
  } catch {
    errorMessage.value = 'Mot de passe incorrect'
    password.value = ''
  }
}
</script>

<template>
  <div class="app-fixed-layout bg-gray-100 items-center justify-center p-4" style="overflow-y: auto !important;">
    <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800">CheckFlow</h1>
        <p class="text-gray-500 mt-2">Qui etes-vous ?</p>
      </div>

      <!-- Loading -->
      <div v-if="isLoadingOperators" class="text-center py-8 text-gray-400">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
      </div>

      <!-- No operators -->
      <div v-else-if="operators.length === 0" class="text-center py-8 text-gray-400">
        <i class="pi pi-users text-3xl mb-3"></i>
        <p>Aucun operateur assigne a cet evenement.</p>
        <p class="text-sm mt-2">Contactez l'administrateur.</p>
      </div>

      <!-- Operator selection (no one selected yet) -->
      <div v-else-if="!selectedOperator">
        <div class="space-y-3">
          <button
            v-for="op in operators" :key="op.id"
            class="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
            @click="selectOperator(op)"
          >
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
              :class="roleColors[op.role] || 'bg-gray-400'"
            >
              {{ getInitials(op) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-gray-800">{{ op.firstName }} {{ op.lastName }}</div>
              <div class="text-sm text-gray-400">{{ getRoleLabel(op.role) }}</div>
            </div>
            <i class="pi pi-chevron-right text-gray-300"></i>
          </button>
        </div>
      </div>

      <!-- Password entry (operator selected) -->
      <div v-else>
        <!-- Selected user header -->
        <button class="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 border-2 border-blue-500 mb-6 text-left" @click="deselectOperator">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
            :class="roleColors[selectedOperator.role] || 'bg-gray-400'"
          >
            {{ getInitials(selectedOperator) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-800">{{ selectedOperator.firstName }} {{ selectedOperator.lastName }}</div>
            <div class="text-sm text-gray-400">{{ getRoleLabel(selectedOperator.role) }}</div>
          </div>
          <span class="text-xs text-blue-500">Changer</span>
        </button>

        <form @submit.prevent="handleLogin">
          <div class="mb-4">
            <label for="password" class="text-sm font-medium text-gray-700 mb-2 block">Mot de passe</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggleMask
              inputClass="w-full"
              class="w-full"
              placeholder="Entrez votre mot de passe"
              required
            />
          </div>

          <div v-if="errorMessage" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
            {{ errorMessage }}
          </div>

          <Button
            type="submit"
            label="Se connecter"
            icon="pi pi-sign-in"
            :loading="auth.isLoading"
            :disabled="!password"
            class="w-full"
          />
        </form>
      </div>
    </div>
  </div>
</template>
