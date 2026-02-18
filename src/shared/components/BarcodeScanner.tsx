import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/components/IconButton'
import { Button } from '@/shared/components/ui/Button'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
]

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const hasScannedRef = useRef(false)

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch (e) {
      console.warn('Failed to stop scanner:', e)
    }
    try {
      scannerRef.current?.clear()
    } catch (e) {
      console.warn('Failed to clear scanner:', e)
    }
  }, [])

  useEffect(() => {
    const readerId = 'barcode-scanner-reader'
    let mounted = true

    const startScanner = async () => {
      try {
        const minDim = Math.min(window.innerWidth, window.innerHeight)
        const qrBoxSize = Math.floor(minDim * 0.75)

        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        })
        scannerRef.current = scanner

        const config = {
          fps: 15,
          qrbox: { width: qrBoxSize, height: Math.floor(qrBoxSize * 0.6) },
          disableFlip: false,
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!hasScannedRef.current && mounted) {
              hasScannedRef.current = true
              if (navigator.vibrate) navigator.vibrate(200)
              setScannedCode(decodedText)
              setTimeout(() => {
                if (mounted) onScan(decodedText)
              }, 600)
            }
          },
          () => {}
        )

        if (mounted) setIsStarting(false)
      } catch (err) {
        if (!mounted) return
        console.error('Scanner start error:', err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setError('Camera access denied. Please allow camera permissions.')
        } else if (msg.includes('NotFoundError') || msg.includes('no camera')) {
          setError('No camera found on this device.')
        } else {
          setError(`Camera error: ${msg}`)
        }
        setIsStarting(false)
      }
    }

    const timer = setTimeout(startScanner, 300)

    return () => {
      mounted = false
      clearTimeout(timer)
      stopScanner()
    }
  }, [onScan, stopScanner])

  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      className="fixed inset-0 z-[600] bg-black text-white flex flex-col"
    >
      {/* Header / Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-[60px] flex items-center justify-between px-5 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <span
          id="barcode-scanner-title"
          className="font-semibold text-lg tracking-wide"
        >
          Scan Medication
        </span>
        <IconButton
          type="button"
          onClick={handleClose}
          aria-label="Close scanner"
          size="md"
          className="!w-9 !h-9 !rounded-full !bg-white/20 !text-white hover:!bg-white/30 backdrop-blur-sm border-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </div>

      {/* Main Scanner Area */}
      <div className="flex-1 relative overflow-hidden">
        <div id="barcode-scanner-reader" className="w-full h-full object-cover" />

        {/* Overlay UI when camera is active */}
        {!isStarting && !error && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[320px] h-[200px] rounded-2xl border-2 transition-[border-color] duration-200',
                'shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]',
                scannedCode ? 'border-[#34C759] border-[3px]' : 'border-white/40'
              )}
            >
              {/* Corner Markers */}
              {(() => {
                const c = scannedCode ? '#34C759' : '#00E0FF'
                return (
                  <>
                    <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 rounded-tl-2xl" style={{ borderColor: c }} />
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 rounded-tr-2xl" style={{ borderColor: c }} />
                    <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 rounded-bl-2xl" style={{ borderColor: c }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 rounded-br-2xl" style={{ borderColor: c }} />
                  </>
                )
              })()}

              {/* Scanning laser — hide once scanned */}
              {!scannedCode && (
                <div
                  className="absolute left-2.5 right-2.5 h-0.5 rounded-full bg-[#00E0FF] shadow-[0_0_8px_1px_#00E0FF] animate-scan-laser"
                />
              )}

              {/* Success checkmark */}
              {scannedCode && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[#34C759] text-sm font-bold">Code Scanned!</span>
                  <span className="text-white/50 text-[11px] font-mono">{scannedCode}</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-20 left-0 right-0 text-center text-white/85 text-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {scannedCode ? 'Looking up medication...' : 'Align barcode within frame'}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isStarting && !error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white/70 gap-4">
            <div className="w-10 h-10 border-[3px] border-white/20 border-t-[#00E0FF] rounded-full [animation:spin_1s_linear_infinite]" />
            <span>Starting camera...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-[#FF3B30] flex items-center justify-center mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Scanner Error</h3>
            <p className="text-white/60 text-sm leading-relaxed mb-6">{error}</p>
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
              className="!bg-[#333] !text-white !border-[#444] hover:!bg-[#444] max-w-[200px]"
            >
              Close Scanner
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
