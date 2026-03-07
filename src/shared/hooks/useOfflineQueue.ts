/**
 * useOfflineQueue — manages the IndexedDB offline mutation queue.
 *
 * Listens to online/offline events, Background Sync SW messages,
 * and replays queued mutations in the correct service layer.
 * Shows a "Syncing…" badge via isSyncing state.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OfflineQueue } from '@/shared/services/offline-queue'
import type { QueuedMutation } from '@/shared/services/offline-queue'
import { DoseLogsService } from '@/shared/services/dose-logs'
import { NotesService } from '@/shared/services/notes'
import { JournalService } from '@/shared/services/journal'

export function useOfflineQueue() {
  const queryClient = useQueryClient()
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const replayingRef = useRef(false)

  // Update pending count on mount and when online
  useEffect(() => {
    OfflineQueue.getAll().then((all) => setPendingCount(all.length)).catch(() => {})
  }, [])

  const replayQueue = async () => {
    if (replayingRef.current) return
    replayingRef.current = true
    setIsSyncing(true)
    try {
      await OfflineQueue.pruneStale()
      const mutations = await OfflineQueue.getAll()
      if (mutations.length === 0) return

      for (const m of mutations) {
        try {
          await replayMutation(m)
          await OfflineQueue.remove(m.id)
        } catch {
          await OfflineQueue.incrementRetry(m.id)
        }
      }

      // Refresh all potentially affected queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dose_logs'] }),
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['journal'] }),
      ])

      const remaining = await OfflineQueue.getAll()
      setPendingCount(remaining.length)
    } finally {
      replayingRef.current = false
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void replayQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for Background Sync messages from the service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_QUEUE') {
        void replayQueue()
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isOnline, isSyncing, pendingCount }
}

async function replayMutation(m: QueuedMutation): Promise<void> {
  switch (m.type) {
    case 'dose.log':
      await DoseLogsService.logDose(m.payload as Parameters<typeof DoseLogsService.logDose>[0])
      break
    case 'note.add':
      await NotesService.create(m.payload as Parameters<typeof NotesService.create>[0])
      break
    case 'journal.add':
      await JournalService.create(m.payload as Parameters<typeof JournalService.create>[0])
      break
  }
}
