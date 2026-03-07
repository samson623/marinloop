/**
 * Offline Mutation Queue — IndexedDB-backed
 *
 * Stores mutations that failed due to network offline.
 * useOfflineQueue.ts replays them when the browser comes back online.
 * Background Sync (sw.js) fires SYNC_QUEUE to wake the hook.
 */

export type QueuedMutationType = 'dose.log' | 'note.add' | 'journal.add'

export interface QueuedMutation {
  id: string
  type: QueuedMutationType
  payload: Record<string, unknown>
  createdAt: string
  retries: number
}

const DB_NAME  = 'marinloop-offline'
const DB_VER   = 1
const STORE    = 'mutations'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('createdAt', 'createdAt', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export const OfflineQueue = {
  async enqueue(type: QueuedMutationType, payload: Record<string, unknown>): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const item: QueuedMutation = {
        id: crypto.randomUUID(),
        type,
        payload,
        createdAt: new Date().toISOString(),
        retries: 0,
      }
      const req = tx.objectStore(STORE).add(item)
      req.onsuccess = () => {
        resolve()
        // Request a background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then((sw) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            void (sw as any).sync.register('marinloop-queue')
          }).catch(() => {})
        }
      }
      req.onerror = () => reject(req.error)
    })
  },

  async getAll(): Promise<QueuedMutation[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => {
        const now = Date.now()
        // Filter out stale items (> 7 days old)
        resolve((req.result as QueuedMutation[]).filter(
          (m) => now - new Date(m.createdAt).getTime() < MAX_AGE_MS
        ))
      }
      req.onerror = () => reject(req.error)
    })
  },

  async remove(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).delete(id)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  },

  async incrementRetry(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const getReq = tx.objectStore(STORE).get(id)
      getReq.onsuccess = () => {
        const item = getReq.result as QueuedMutation | undefined
        if (!item) { resolve(); return }
        item.retries += 1
        const putReq = tx.objectStore(STORE).put(item)
        putReq.onsuccess = () => resolve()
        putReq.onerror   = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  },

  async pruneStale(): Promise<void> {
    const db = await openDB()
    // getAll() already filters stale, so fetch everything directly to delete them
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const now = Date.now()
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) { resolve(); return }
        const item = cursor.value as QueuedMutation
        if (now - new Date(item.createdAt).getTime() >= MAX_AGE_MS || item.retries >= 5) {
          cursor.delete()
        }
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  },
}
