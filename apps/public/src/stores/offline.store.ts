import { defineStore } from 'pinia'
import { ref, computed, onMounted } from 'vue'
import api from '@/lib/axios'
import { useConfigStore } from './config.store'

interface QueuedAction {
  id: string
  type: 'CHECKIN' | 'SIGN' | 'STATUS'
  participantId: string
  documentDefId?: string
  signatureData?: string
  status?: string
  timestamp: number
}

const DB_NAME = 'checkflow-offline'
const STORE_PARTICIPANTS = 'participants'
const STORE_QUEUE = 'queue'

export const useOfflineStore = defineStore('offline', () => {
  const isOnline = ref(navigator.onLine)
  const cachedParticipants = ref<any[]>([])
  const pendingActions = ref<QueuedAction[]>([])
  const lastSync = ref<string | null>(localStorage.getItem('checkflow_last_sync'))
  const isSyncing = ref(false)

  const hasPendingActions = computed(() => pendingActions.value.length > 0)

  // IndexedDB helpers
  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_PARTICIPANTS)) {
          db.createObjectStore(STORE_PARTICIPANTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function saveParticipantsToCache(participants: any[]) {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_PARTICIPANTS, 'readwrite')
      const store = tx.objectStore(STORE_PARTICIPANTS)
      // Clear and re-add all
      store.clear()
      for (const p of participants) {
        store.put(p)
      }
      cachedParticipants.value = participants
      lastSync.value = new Date().toISOString()
      localStorage.setItem('checkflow_last_sync', lastSync.value)
      db.close()
    } catch {}
  }

  async function loadParticipantsFromCache(): Promise<any[]> {
    try {
      const db = await openDB()
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_PARTICIPANTS, 'readonly')
        const store = tx.objectStore(STORE_PARTICIPANTS)
        const req = store.getAll()
        req.onsuccess = () => { cachedParticipants.value = req.result; resolve(req.result) }
        req.onerror = () => resolve([])
        tx.oncomplete = () => db.close()
      })
    } catch { return [] }
  }

  async function addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
    const entry: QueuedAction = { ...action, id: crypto.randomUUID(), timestamp: Date.now() }
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).put(entry)
      db.close()
    } catch {}
    pendingActions.value.push(entry)
  }

  async function loadQueue() {
    try {
      const db = await openDB()
      return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readonly')
        const req = tx.objectStore(STORE_QUEUE).getAll()
        req.onsuccess = () => { pendingActions.value = req.result || [] }
        tx.oncomplete = () => { db.close(); resolve() }
      })
    } catch {}
  }

  async function syncQueue() {
    if (!isOnline.value || isSyncing.value || pendingActions.value.length === 0) return
    isSyncing.value = true
    const config = useConfigStore()
    const slug = config.slug

    const processed: string[] = []

    for (const action of pendingActions.value) {
      try {
        switch (action.type) {
          case 'CHECKIN':
            await api.post(`/events/${slug}/participants/${action.participantId}/status`, { status: 'PRESENT' })
            break
          case 'SIGN':
            if (action.documentDefId && action.signatureData) {
              await api.post(`/events/${slug}/sign/${action.participantId}/${action.documentDefId}`, { signatureData: action.signatureData })
            }
            break
          case 'STATUS':
            await api.post(`/events/${slug}/participants/${action.participantId}/status`, { status: action.status })
            break
        }
        processed.push(action.id)
      } catch {
        // Keep in queue if sync fails
        break
      }
    }

    // Remove processed from IndexedDB
    if (processed.length > 0) {
      try {
        const db = await openDB()
        const tx = db.transaction(STORE_QUEUE, 'readwrite')
        const store = tx.objectStore(STORE_QUEUE)
        for (const id of processed) store.delete(id)
        db.close()
      } catch {}
      pendingActions.value = pendingActions.value.filter(a => !processed.includes(a.id))
    }

    isSyncing.value = false
  }

  // Find participant by QR code in cache
  function findByQrCode(qrCode: string): any | null {
    return cachedParticipants.value.find(p => p.qrCode === qrCode) || null
  }

  // Refresh cache from API
  async function refreshCache() {
    const config = useConfigStore()
    if (!config.slug) return
    try {
      const { data } = await api.get(`/events/${config.slug}/participants`, { params: { limit: 500 } })
      const participants = data.participants || []
      await saveParticipantsToCache(participants)
    } catch {}
  }

  // Setup online/offline listeners
  function init() {
    window.addEventListener('online', () => {
      isOnline.value = true
      syncQueue()
      refreshCache()
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
    loadQueue()
    loadParticipantsFromCache()
  }

  return {
    isOnline,
    cachedParticipants,
    pendingActions,
    lastSync,
    hasPendingActions,
    isSyncing,
    saveParticipantsToCache,
    loadParticipantsFromCache,
    addToQueue,
    syncQueue,
    findByQrCode,
    refreshCache,
    init,
  }
})
