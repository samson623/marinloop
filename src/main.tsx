import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { App } from '@/app/App'
import { reportError } from '@/shared/lib/errors'

window.onerror = (_message, _source, _lineno, _colno, error) => {
  reportError(error ?? _message, 'window.onerror')
}

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, 'unhandledrejection')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
