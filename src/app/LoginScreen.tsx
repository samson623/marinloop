import { useState } from 'react'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getErrorMessage } from '@/shared/lib/errors'
import { IconButton } from '@/shared/components/IconButton'
import { Button, Input } from '@/shared/components/ui'

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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-bg-primary)] p-4 sm:p-6 md:p-8 min-h-screen overflow-y-auto safe-x"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <IconButton
        size="lg"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </IconButton>

      <div className="w-full max-w-[400px] sm:max-w-[420px] px-2 sm:px-4 py-6 sm:py-8 md:py-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--color-text-secondary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] min-h-[44px] min-w-[44px] [font-size:var(--text-body)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
        )}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <h1 className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] [font-size:var(--text-title)]">
            MedFlow
          </h1>
          <span
            className="animate-dot-pulse w-2 h-2 rounded-[2px] bg-[var(--color-accent)] shrink-0"
            aria-hidden
          />
        </div>
        <p className="text-[var(--color-text-secondary)] mb-8 sm:mb-10 font-normal [font-size:var(--text-body)]">
          {isSignUp ? 'Create your account.' : 'Stay on time. Stay safe. Stay confident.'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5" autoComplete="off">
          {error && (
            <div
              className="animate-fade-in bg-[var(--color-red-bg)] border border-[var(--color-red-border)] text-[var(--color-red)] py-3 px-4 rounded-lg [font-size:var(--text-body)] font-medium"
              role="alert"
            >
              {error}
            </div>
          )}

          {isSignUp && (
            <div>
              <label htmlFor="login-name" className="block font-semibold text-[var(--color-text-secondary)] mb-1.5 sm:mb-2 [font-size:var(--text-label)]">
                Name
              </label>
              <Input
                id="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="min-h-[44px]"
              />
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block font-semibold text-[var(--color-text-secondary)] mb-1.5 sm:mb-2 [font-size:var(--text-label)]">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              required
              className="min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block font-semibold text-[var(--color-text-secondary)] mb-1.5 sm:mb-2 [font-size:var(--text-label)]">
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
              className="min-h-[44px]"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
            className={`min-h-[48px] ${shake ? 'animate-shake' : ''}`}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          <div className="flex items-center gap-3 my-3 sm:my-4 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
            <span className="flex-1 h-px bg-[var(--color-border-primary)]" />
            <span>Or</span>
            <span className="flex-1 h-px bg-[var(--color-border-primary)]" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleGoogle}
            className="min-h-[48px] py-3"
          >
            Continue with Google
          </Button>

          <div className="text-center mt-3 sm:mt-4">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="border-none bg-transparent cursor-pointer [font-size:var(--text-body)] text-[var(--color-accent)] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>

        <p className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-[var(--color-border-primary)] text-[var(--color-text-tertiary)] leading-relaxed [font-size:var(--text-caption)]">
          MedFlow Care provides reminders and tracking tools. Not medical advice. Always follow your healthcare provider&apos;s instructions.
        </p>
      </div>
    </div>
  )
}
