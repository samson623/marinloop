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
  Html5QrcodeSupportedFormats.DATA_MATRIX,
]

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const hasScannedRef = useRef(false)
  const [manualEntry, setManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState('')

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
        const vw = window.innerWidth
        const boxWidth = Math.min(Math.floor(vw * 0.85), 350)
        const boxHeight = Math.min(Math.floor(boxWidth * 0.3), 120)

        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        })
        scannerRef.current = scanner

        const config = {
          fps: 8,
          qrbox: { width: boxWidth, height: boxHeight },
          disableFlip: false,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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

        try {
          const videoElement = document.querySelector(
            '#barcode-scanner-reader video'
          ) as HTMLVideoElement | null
          if (videoElement?.srcObject) {
            const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0]
            const capabilities = track.getCapabilities?.() as { zoom?: { min?: number; max?: number } }
            if (capabilities?.zoom) {
              const midZoom = Math.min(
                capabilities.zoom.max ?? 2,
                Math.max(capabilities.zoom.min ?? 1, 2)
              )
              await track.applyConstraints({
                advanced: [{ zoom: midZoom } as MediaTrackConstraintSet],
              })
            }
          }
        } catch {
          // Zoom not supported
        }

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

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (code.length >= 10) {
      hasScannedRef.current = true
      setScannedCode(code)
      onScan(code)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      className="fixed inset-0 z-[600] bg-black text-white flex flex-col"
    >
      <div className="absolute top-0 left-0 right-0 h-[60px] flex items-center justify-between px-5 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <span id="barcode-scanner-title" className="font-semibold text-lg tracking-wide">
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

      <div className="flex-1 relative overflow-hidden">
        <div id="barcode-scanner-reader" className="w-full h-full object-cover" />

        {!isStarting && !error && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-[85%] max-w-[350px] h-[100px] rounded-xl border-2 transition-[border-color] duration-200',
                'shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]',
                scannedCode ? 'border-[#34C759] border-[3px]' : 'border-white/40'
              )}
            >
              {(() => {
                const c = scannedCode ? '#34C759' : '#00E0FF'
                return (
                  <>
                    <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 rounded-tl-xl" style={{ borderColor: c }} />
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 rounded-tr-xl" style={{ borderColor: c }} />
                    <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 rounded-bl-xl" style={{ borderColor: c }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 rounded-br-xl" style={{ borderColor: c }} />
                  </>
                )
              })()}
              {!scannedCode && (
                <div className="absolute left-2.5 right-2.5 h-0.5 rounded-full bg-[#00E0FF] shadow-[0_0_8px_1px_#00E0FF] animate-scan-laser" />
              )}
              {scannedCode && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[#34C759] text-xs font-bold">Scanned!</span>
                  <span className="text-white/50 text-[10px] font-mono">{scannedCode}</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-28 left-0 right-0 text-center px-6">
              <p className="text-white/85 text-sm" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {scannedCode
                  ? 'Looking up medication...'
                  : 'Flatten the label and align barcode in the strip above'}
              </p>
              <p className="text-white/50 text-xs mt-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Hold steady in good light · Avoid glare
              </p>
            </div>
          </div>
        )}

        {!scannedCode && !error && !isStarting && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setManualEntry(!manualEntry)}
              className="px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-sm font-medium border border-white/20"
            >
              {manualEntry ? 'Hide manual entry' : "Can't scan? Enter number manually"}
            </button>
          </div>
        )}

        {manualEntry && (
          <div className="absolute bottom-16 left-4 right-4 z-30 bg-black/90 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto">
            <label className="block text-white/70 text-xs font-semibold mb-2 uppercase tracking-wider">
              Enter NDC or UPC number from bottle
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="e.g. 0378-4117-01 or 303784117012"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00E0FF]"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={manualCode.replace(/\D/g, '').length < 10}
                className="px-4 py-2.5 bg-[#00E0FF] text-black font-bold rounded-lg text-sm disabled:opacity-40"
              >
                Look up
              </button>
            </div>
          </div>
        )}

        {isStarting && !error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white/70 gap-4">
            <div className="w-10 h-10 border-[3px] border-white/20 border-t-[#00E0FF] rounded-full [animation:spin_1s_linear_infinite]" />
            <span>Starting camera...</span>
          </div>
        )}

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
