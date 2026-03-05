import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import '@/styles/globals.css'
import { App } from '@/app/App'
import { reportError } from '@/shared/lib/errors'
import { env } from '@/shared/lib/env'

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: import.meta.env.MODE,
    release: 'marinloop@1.0.0-beta',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Strip user PII before sending — important for a healthcare-adjacent app
    beforeSend(event) {
      if (event.user) {
        delete event.user.email
        delete event.user.username
      }
      return event
    },
  })
}

window.onerror = (_message, _source, _lineno, _colno, error) => {
  reportError(error ?? _message, 'window.onerror')
}

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, 'unhandledrejection')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
