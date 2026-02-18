import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

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

    // Cleanup function
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
                // Determine best box size based on window
                const minDim = Math.min(window.innerWidth, window.innerHeight)
                const qrBoxSize = Math.floor(minDim * 0.75) // 75% of smallest dimension

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
                            // Brief visual confirmation before forwarding
                            setTimeout(() => {
                                if (mounted) onScan(decodedText)
                            }, 600)
                        }
                    },
                    () => {
                        // ignore failures
                    }
                )

                if (mounted) setIsStarting(false)
            } catch (err) {
                if (!mounted) return
                console.error("Scanner start error:", err)
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

        // Small delay to ensure DOM is ready and animations have settled
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
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 600,
                background: '#000',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header / Top Bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 20px',
                    zIndex: 20,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
                }}
            >
                <span id="barcode-scanner-title" style={{ fontWeight: 600, fontSize: 18, letterSpacing: '0.5px' }}>Scan Medication</span>
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close scanner"
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Main Scanner Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div id="barcode-scanner-reader" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                {/* Overlay UI when camera is active */}
                {!isStarting && !error && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        {/* Darkened borders to highlight scan area */}
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '80%',
                            maxWidth: 320,
                            height: 200,
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                            borderRadius: 16,
                            border: scannedCode ? '3px solid #34C759' : '2px solid rgba(255, 255, 255, 0.4)',
                            transition: 'border-color 0.2s',
                        }}>
                            {/* Corner Markers */}
                            {(() => {
                                const c = scannedCode ? '#34C759' : '#00E0FF'; return <>
                                    <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: `4px solid ${c}`, borderLeft: `4px solid ${c}`, borderTopLeftRadius: 16 }} />
                                    <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: `4px solid ${c}`, borderRight: `4px solid ${c}`, borderTopRightRadius: 16 }} />
                                    <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: `4px solid ${c}`, borderLeft: `4px solid ${c}`, borderBottomLeftRadius: 16 }} />
                                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: `4px solid ${c}`, borderRight: `4px solid ${c}`, borderBottomRightRadius: 16 }} />
                                </>
                            })()}

                            {/* Scanning Laser Animation — hide once scanned */}
                            {!scannedCode && <div style={{
                                position: 'absolute',
                                left: 10, right: 10,
                                height: 2,
                                background: '#00E0FF',
                                boxShadow: '0 0 8px 1px #00E0FF',
                                borderRadius: '50%',
                                animation: 'scan-laser 2s ease-in-out infinite'
                            }} />}

                            {/* Success checkmark */}
                            {scannedCode && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span style={{ color: '#34C759', fontSize: 14, fontWeight: 700 }}>Code Scanned!</span>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}>{scannedCode}</span>
                                </div>
                            )}

                            <style>{`
                                @keyframes scan-laser {
                                    0% { top: 10%; opacity: 0; }
                                    10% { opacity: 1; }
                                    90% { opacity: 1; }
                                    100% { top: 90%; opacity: 0; }
                                }
                            `}</style>
                        </div>

                        <div style={{
                            position: 'absolute',
                            bottom: 80, left: 0, right: 0,
                            textAlign: 'center',
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: 14,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}>
                            {scannedCode ? 'Looking up medication...' : 'Align barcode within frame'}
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isStarting && !error && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: '#000',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(255,255,255,0.7)',
                        gap: 16
                    }}>
                        <div style={{
                            width: 40, height: 40,
                            border: '3px solid rgba(255,255,255,0.2)',
                            borderTopColor: '#00E0FF',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <span>Starting camera...</span>
                        <style>{`
                                @keyframes spin {
                                    to { transform: rotate(360deg); }
                                }
                        `}</style>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: '#1a1a1a',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: 32, textAlign: 'center'
                    }}>
                        <div style={{
                            width: 64, height: 64,
                            borderRadius: '50%',
                            background: 'rgba(255, 59, 48, 0.1)',
                            color: '#FF3B30',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 20
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Scanner Error</h3>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>{error}</p>
                        <button
                            onClick={handleClose}
                            style={{
                                padding: '12px 24px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Close Scanner
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
