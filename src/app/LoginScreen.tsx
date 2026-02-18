import { useState } from 'react'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getErrorMessage } from '@/shared/lib/errors'

type LoginScreenProps = {
  onBack?: () => void
}

export function LoginScreen({ onBack }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  const { toggleTheme } = useThemeStore()
  const { toast } = useAppStore()
  const { signInWithEmail, signUp, signInWithGoogle } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const res = await signUp(email, pass, name)
        if (res.error) throw res.error
        toast('Account created. Please sign in.', 'ts')
        setIsSignUp(false)
        return
      }

      const res = await signInWithEmail(email, pass)
      if (res.error) throw res.error
      toast('Signed in successfully', 'ts')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Authentication failed'))
      setShake(true)
      setTimeout(() => setShake(false), 400)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const { error: authError } = await signInWithGoogle()
    if (authError) toast(authError.message, 'te')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)',
    }}>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          position: 'absolute', top: 20, right: 20, width: 40, height: 40,
          background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-primary)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--color-text-secondary)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </button>

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>MedFlow</h1>
          <span className="animate-dot-pulse" style={{ width: 8, height: 8, background: 'var(--color-accent)', borderRadius: 2 }} />
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 40, fontWeight: 400 }}>
          {isSignUp ? 'Create your account.' : 'Stay on time. Stay safe. Stay confident.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} autoComplete="off">
          {error && (
            <div className="animate-fade-in" style={{
              background: 'var(--color-red-bg)', border: '1px solid var(--color-red-border)',
              color: 'var(--color-red)', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {isSignUp && (
            <div>
              <label htmlFor="login-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</label>
              <input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required style={{ width: '100%', padding: '13px 14px', background: 'var(--color-bg-tertiary)', border: '1.5px solid var(--color-border-primary)', color: 'var(--color-text-primary)', fontSize: 15, borderRadius: 10, outline: 'none' }} />
            </div>
          )}

          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" required style={{ width: '100%', padding: '13px 14px', background: 'var(--color-bg-tertiary)', border: '1.5px solid var(--color-border-primary)', color: 'var(--color-text-primary)', fontSize: 15, borderRadius: 10, outline: 'none' }} />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password</label>
            <input id="login-password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Enter password" required minLength={6} style={{ width: '100%', padding: '13px 14px', background: 'var(--color-bg-tertiary)', border: '1.5px solid var(--color-border-primary)', color: 'var(--color-text-primary)', fontSize: 15, borderRadius: 10, outline: 'none' }} />
          </div>

          <button type="submit" disabled={loading} className={shake ? 'animate-shake' : ''} style={{
            width: '100%', padding: 14, background: 'var(--color-accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer', borderRadius: 10, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0', color: 'var(--color-text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border-primary)' }} />
            <span>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border-primary)' }} />
          </div>

          <button type="button" onClick={handleGoogle} style={{
            width: '100%', padding: 12, background: 'transparent', border: '1.5px solid var(--color-border-primary)', color: 'var(--color-text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 10,
          }}>
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-accent)', fontWeight: 600,
            }}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border-primary)', fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
          This app assists with medication tracking and reminders. It does not provide medical advice. Always follow instructions from your healthcare provider.
        </p>
      </div>
    </div>
  )
}