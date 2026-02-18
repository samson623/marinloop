import { useState } from 'react'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getErrorMessage } from '@/shared/lib/errors'
import { usePushNotifications } from '@/shared/hooks/usePushNotifications'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import { AddToHomeScreenPrompt, setAddToHomeScreenSeen } from '@/shared/components/AddToHomeScreenPrompt'

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>Profile</h1>
        <button onClick={() => setShowProfile(false)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div style={{ padding: 20, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'var(--color-text-secondary)', overflow: 'hidden' }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{profile?.name || (isDemo ? 'Demo User' : 'User')}</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{user?.email}</p>
        </div>
        {isDemo && <div style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-amber-bg)', color: 'var(--color-amber)', padding: '4px 10px', borderRadius: 20 }}>DEMO MODE</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: 16, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Plan</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Joined</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{joined}</div>
        </div>
      </div>

      {!isDemo && (
        <div style={{ padding: 16, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>Multi-Factor Authentication</div>
          {!qrCode && (
            <button onClick={handleEnrollMfa} disabled={mfaLoading} style={{ width: '100%', padding: 12, background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-primary)', borderRadius: 10, cursor: mfaLoading ? 'wait' : 'pointer' }}>
              {mfaLoading ? 'Enrolling...' : 'Enroll TOTP MFA'}
            </button>
          )}

          {qrCode && (
            <>
              <div style={{ marginTop: 12, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: qrCode }} />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" className="fi" style={{ width: '100%', marginBottom: 8 }} />
              <button onClick={handleVerifyMfa} disabled={mfaLoading} style={{ width: '100%', padding: 12, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: mfaLoading ? 'wait' : 'pointer' }}>
                {mfaLoading ? 'Verifying...' : 'Verify MFA'}
              </button>
            </>
          )}
        </div>
      )}

      {!isDemo && installPrompt.canInstall && (
        <div style={{ padding: 16, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', marginBottom: 8 }}>Add to your phone</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>Get MedFlow on your home screen for reminders.</p>
          <button
            type="button"
            onClick={async () => {
              const accepted = await installPrompt.promptInstall()
              if (accepted) toast('MedFlow added to your phone', 'ts')
            }}
            style={{
              width: '100%', padding: 12, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Add MedFlow to your phone
          </button>
        </div>
      )}

      {!isDemo && (
        <div style={{ padding: 16, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>Push Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
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
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', padding: 2,
                background: push.isSubscribed ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                cursor: !push.isSupported || push.permission === 'denied' || push.isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                display: 'flex', alignItems: 'center',
                opacity: !push.isSupported || push.permission === 'denied' ? 0.5 : 1,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transform: push.isSubscribed ? 'translateX(22px)' : 'translateX(0)',
                transition: 'transform 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => { void signOut() }} style={{ width: '100%', padding: 14, background: 'var(--color-red-bg)', border: '1px solid var(--color-red-border)', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'var(--color-red)', cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.6, textAlign: 'center' }}>
        MedFlow Care v1.0.0
      </p>
    </div>
  )
}