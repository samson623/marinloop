import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getErrorMessage } from '@/shared/lib/errors'
import { usePushNotifications } from '@/shared/hooks/usePushNotifications'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import { AddToHomeScreenPrompt, setAddToHomeScreenSeen } from '@/shared/components/AddToHomeScreenPrompt'
import { IconButton } from '@/shared/components/IconButton'
import { Button, Input, Card } from '@/shared/components/ui'

export function ProfileView() {
  const { setShowProfile, toast } = useAppStore()
  const { user, profile, isDemo, signOut, enrollMfa, verifyMfa } = useAuthStore()
  const push = usePushNotifications()
  const installPrompt = useInstallPrompt()

  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'

  const handleEnrollMfa = async () => {
    setMfaLoading(true)
    const { data, error } = await enrollMfa()
    setMfaLoading(false)

    if (error || !data) {
      toast(getErrorMessage(error, 'Failed to enroll MFA'), 'te')
      return
    }

    setFactorId(data.factorId)
    setQrCode(data.qrCodeSvg)
    toast('MFA factor enrolled. Enter your 6-digit code to verify.', 'ts')
  }

  const handleVerifyMfa = async () => {
    if (!factorId || code.trim().length < 6) {
      toast('Enter a valid MFA code', 'tw')
      return
    }

    setMfaLoading(true)
    const { error } = await verifyMfa(factorId, code.trim())
    setMfaLoading(false)

    if (error) {
      toast(getErrorMessage(error, 'MFA verification failed'), 'te')
      return
    }

    toast('MFA verified', 'ts')
    setCode('')
  }

  return (
    <div className="animate-view-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">Profile</h1>
        <IconButton
          size="sm"
          aria-label="Close profile"
          onClick={() => setShowProfile(false)}
          className="w-8 h-8 rounded-full"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </IconButton>
      </div>

      <Card className="p-5 flex flex-col items-center gap-3 mb-5 rounded-2xl">
        <div className="w-20 h-20 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[32px] font-bold text-[var(--color-text-secondary)] overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (profile?.name?.[0] || user?.email?.[0] || '?').toUpperCase()
          )}
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {profile?.name || (isDemo ? 'Demo User' : 'User')}
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">{user?.email}</p>
        </div>
        {isDemo && (
          <span className="text-[11px] font-bold bg-[var(--color-amber-bg)] text-[var(--color-amber)] py-1 px-2.5 rounded-[20px]">
            DEMO MODE
          </span>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4 rounded-xl">
          <div className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-[0.05em] mb-1">Plan</div>
          <div className="text-base font-bold text-[var(--color-text-primary)]">
            {profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'}
          </div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-[0.05em] mb-1">Joined</div>
          <div className="text-base font-bold text-[var(--color-text-primary)]">{joined}</div>
        </Card>
      </div>

      {!isDemo && (
        <Card className="p-4 mb-5 rounded-xl">
          <div className="text-xs font-bold mb-2.5 uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
            Multi-Factor Authentication
          </div>
          {!qrCode && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleEnrollMfa}
              disabled={mfaLoading}
              className="py-3"
            >
              {mfaLoading ? 'Enrolling...' : 'Enroll TOTP MFA'}
            </Button>
          )}

          {qrCode && (
            <>
              <div className="my-3 [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: qrCode }} />
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="mb-2"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleVerifyMfa}
                disabled={mfaLoading}
                className="py-3"
              >
                {mfaLoading ? 'Verifying...' : 'Verify MFA'}
              </Button>
            </>
          )}
        </Card>
      )}

      {!isDemo && installPrompt.canInstall && (
        <Card className="p-4 mb-5 rounded-xl">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-2">
            Add to your phone
          </div>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mb-3">
            Get MedFlow on your home screen for reminders.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="py-3"
            onClick={async () => {
              const accepted = await installPrompt.promptInstall()
              if (accepted) toast('MedFlow added to your phone', 'ts')
            }}
          >
            Add MedFlow to your phone
          </Button>
        </Card>
      )}

      {!isDemo && (
        <Card className="p-4 mb-5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                Push Notifications
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {!push.isSupported
                  ? 'Not supported in this browser'
                  : push.permission === 'denied'
                    ? 'Blocked — update in browser settings'
                    : push.isSubscribed
                      ? 'Medication reminders enabled'
                      : 'Enable to get dose & appointment reminders'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => push.isSubscribed ? push.unsubscribe() : push.subscribe()}
              disabled={!push.isSupported || push.permission === 'denied' || push.isLoading}
              aria-label={push.isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
              aria-checked={push.isSubscribed}
              role="switch"
              className={cn(
                'w-12 h-[26px] rounded-[13px] border-none p-0.5 flex items-center transition-[background] duration-200 outline-none cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                push.isSubscribed ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'
              )}
            >
              <div
                className="w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
                style={{ transform: push.isSubscribed ? 'translateX(22px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </Card>
      )}

      {push.showAddToHomeScreenHelp && (
        <AddToHomeScreenPrompt
          variant="push-failed"
          onDismiss={() => {
            push.setShowAddToHomeScreenHelp(false)
            setAddToHomeScreenSeen()
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        <Button type="button" variant="danger" size="md" onClick={() => { void signOut() }}>
          Sign Out
        </Button>
      </div>

      <p className="mt-6 text-[11px] text-[var(--color-text-tertiary)] leading-relaxed text-center">
        MedFlow Care v1.0.0
      </p>
    </div>
  )
}
