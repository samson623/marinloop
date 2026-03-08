import { useMutation } from '@tanstack/react-query'
import { AccountService } from '../services/account'
import { useAuthStore } from '../stores/auth-store'
import { useAppStore } from '../stores/app-store'
import { getErrorMessage } from '../lib/errors'

export function useAccount() {
  const { signOut } = useAuthStore()
  const { toast } = useAppStore()

  const deleteAccount = useMutation({
    mutationFn: async () => {
      await AccountService.deleteAllData()
      await signOut()
    },
  })

  const exportData = useMutation({
    mutationFn: async () => {
      const blob = await AccountService.exportData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `marinloop-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast('Data export downloaded', 'ts'),
    onError: (err: unknown) => toast(getErrorMessage(err, 'Could not export data'), 'te'),
  })

  return { deleteAccount, exportData }
}
