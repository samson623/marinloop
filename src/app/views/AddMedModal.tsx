import { useEffect, useState, useRef, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/shared/stores/app-store'
import { isMobile } from '@/shared/lib/device'
import { Modal } from '@/shared/components/Modal'
import { extractFromImages } from '@/shared/services/label-extract'
import { useAIConsent } from '@/shared/hooks/useAIConsent'
import { lookupRxCUI, getOpenFDALabel, getIngredients } from '@/shared/services/rxnorm'
import { useInteractions } from '@/shared/hooks/useInteractions'
import type { DrugInteraction } from '@/shared/services/rxnorm'
import { useSubscription } from '@/shared/hooks/useSubscription'
import { handleMutationError } from '@/shared/lib/errors'
import { Button, Input } from '@/shared/components/ui'
import { generateEvenlySpacedTimes } from '@/shared/lib/scheduling'

type AddMedModalProps = {
  onClose: () => void
  isSaving: boolean
  initialDraft: {
    name?: string
    dose?: string
    freq?: number
    time?: string
    supply?: number
    instructions?: string
    warnings?: string
  } | null
  openPhoto?: boolean
  allMeds?: Array<{ id: string; name: string; rxcui?: string | null }>
  upcomingAppts?: Array<{ title: string; start_time: string; commute_minutes: number | null | undefined }>
  userAllergies?: string[]
  createBundleAsync: (input: {
    medication: { name: string; dosage: string; freq: number; instructions: string; warnings: string; color: string; icon: string; rxcui?: string }
    schedules: Array<{ time: string; days: number[]; food_context_minutes: number; active: boolean }>
    refill: { current_quantity: number; total_quantity: number; refill_date: string | null; pharmacy: string | null }
  }) => Promise<string>
}

export default function AddMedModal({ onClose, createBundleAsync, isSaving, initialDraft, openPhoto: openPhotoProp, allMeds = [], upcomingAppts = [], userAllergies = [] }: AddMedModalProps) {
  const navigate = useNavigate()
  const inputIdBase = useId().replace(/:/g, '')
  const { toast } = useAppStore()
  const { consented } = useAIConsent()
  const { canUseOcr } = useSubscription()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [freq, setFreq] = useState('1')
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [sup, setSup] = useState('30')
  const [inst, setInst] = useState('')
  const [warn, setWarn] = useState('')
  const [isLooking, setIsLooking] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [pendingExtract, setPendingExtract] = useState<{
    name?: string
    dosage?: string
    freq?: number
    time?: string
    quantity?: number
    instructions?: string
    warnings?: string
    confidence?: number
  } | null>(null)
  const [labelPhotos, setLabelPhotos] = useState<File[]>([])
  const [photoThumbs, setPhotoThumbs] = useState<string[]>([])
  const [rxcui, setRxcui] = useState<string | null>(null)
  const [isLookingUpRxcui, setIsLookingUpRxcui] = useState(false)
  const [foodNote, setFoodNote] = useState<string | null>(null)
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const labelPhotoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoMenuBtnRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const labelPhotoInputId = `label-photo-input-${inputIdBase}`
  const cameraInputId = `camera-input-${inputIdBase}`
  const fileInputId = `file-input-${inputIdBase}`

  // Drug interaction check (background, non-blocking)
  const { interactions } = useInteractions(allMeds, name)

  useEffect(() => {
    return () => {
      // Stop any active camera stream when the modal unmounts
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const openCameraModal = useCallback(async () => {
    setShowPhotoMenu(false)
    setShowCameraModal(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast('Camera access denied or unavailable.', 'te')
      setShowCameraModal(false)
    }
  }, [toast])

  const closeCameraModal = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setShowCameraModal(false)
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      addLabelPhoto(file)
      closeCameraModal()
    }, 'image/jpeg', 0.92)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addLabelPhoto uses only stable setters; omitting it avoids recreating capturePhoto on every render
  }, [closeCameraModal])

  const handleFreqChange = (newFreq: string) => {
    const n = Number.parseInt(newFreq, 10) || 1
    setFreq(newFreq)
    setTimes((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) {
        return generateEvenlySpacedTimes(n, prev[0])
      }
      return prev.slice(0, n)
    })
  }

  const updateTimeAtIndex = (index: number, value: string) => {
    setTimes((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  const openHiddenFileInput = (input: HTMLInputElement | null) => {
    if (!input) return
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker()
        return
      }
    } catch {
      // Fall back to click for browsers that gate or lack showPicker.
    }
    input.click()
  }

  useEffect(() => {
    if (!initialDraft) return
    if (initialDraft.name) setName(initialDraft.name)
    if (initialDraft.dose) setDose(initialDraft.dose)
    if (typeof initialDraft.freq === 'number') {
      setFreq(String(initialDraft.freq))
      if (initialDraft.time) {
        setTimes(initialDraft.freq > 1 ? generateEvenlySpacedTimes(initialDraft.freq, initialDraft.time) : [initialDraft.time])
      } else {
        setTimes(generateEvenlySpacedTimes(initialDraft.freq))
      }
    } else if (initialDraft.time) {
      setTimes([initialDraft.time])
    }
    if (typeof initialDraft.supply === 'number') setSup(String(initialDraft.supply))
    if (initialDraft.instructions) setInst(initialDraft.instructions)
    if (initialDraft.warnings) setWarn(initialDraft.warnings)
  }, [initialDraft])

  useEffect(() => {
    if (openPhotoProp && canUseOcr) {
      const timer = setTimeout(() => openHiddenFileInput(labelPhotoInputRef.current), 150)
      return () => clearTimeout(timer)
    }
  }, [openPhotoProp, canUseOcr])

  // Background rxcui lookup on name blur + food interaction + allergy check
  const handleNameBlur = async () => {
    const trimmed = name.trim()
    if (trimmed.length <= 2) return
    setIsLookingUpRxcui(true)
    setAllergyWarning(null)
    try {
      const code = await lookupRxCUI(trimmed)
      setRxcui(code)
      if (code) {
        const [labelData, ingredients] = await Promise.all([
          getOpenFDALabel(code),
          getIngredients(code),
        ])
        if (labelData.foodInteractions && labelData.foodInteractions.trim()) {
          setFoodNote(labelData.foodInteractions.trim())
        }
        if (userAllergies.length > 0 && ingredients.length > 0) {
          const lower = ingredients.map((i) => i.toLowerCase())
          const matched = userAllergies.find((a) =>
            lower.some((i) => i.includes(a.toLowerCase()) || a.toLowerCase().includes(i))
          )
          if (matched) {
            setAllergyWarning(`You have a listed allergy to "${matched}" — this medication contains it as an ingredient.`)
          }
        }
      }
    } finally {
      setIsLookingUpRxcui(false)
    }
  }

  // Appointment conflict check (pure computed, no async)
  const apptConflicts: Array<{ apptTitle: string; apptTime: string; medTime: string }> = []
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  for (const appt of upcomingAppts) {
    const apptStart = new Date(appt.start_time)
    if (apptStart < now || apptStart > sevenDaysLater) continue
    const commute = appt.commute_minutes ?? 0
    const windowStart = new Date(apptStart.getTime() - commute * 60 * 1000)
    const windowEnd = new Date(apptStart.getTime() + 60 * 60 * 1000)
    const apptTimeStr = apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    for (const t of times) {
      const [h, m] = t.split(':').map(Number)
      // Use today's date for comparison
      const medDate = new Date(apptStart)
      medDate.setHours(h, m, 0, 0)
      if (medDate >= windowStart && medDate <= windowEnd) {
        apptConflicts.push({
          apptTitle: appt.title,
          apptTime: apptTimeStr,
          medTime: t,
        })
      }
    }
  }

  const applyExtractToForm = (r: { name?: string; dosage?: string; freq?: number; time?: string; quantity?: number; instructions?: string; warnings?: string }) => {
    if (r.name?.trim()) setName(r.name)
    if (r.dosage?.trim()) setDose(r.dosage)
    if (typeof r.freq === 'number' && [1, 2, 3].includes(r.freq)) {
      setFreq(String(r.freq))
      if (r.freq > 1) {
        setTimes(generateEvenlySpacedTimes(r.freq, r.time?.trim() || '08:00'))
      } else if (r.time?.trim()) {
        setTimes([r.time])
      }
    } else if (r.time?.trim()) {
      setTimes([r.time])
    }
    if (typeof r.quantity === 'number') setSup(String(r.quantity))
    if (r.instructions?.trim()) setInst(r.instructions)
    if (r.warnings?.trim()) setWarn(r.warnings)
  }

  const addLabelPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'tw')
      return
    }
    if (labelPhotos.length >= 5) {
      toast('Maximum 5 images allowed.', 'tw')
      return
    }
    setLabelPhotos((prev) => [...prev, file])
    const url = URL.createObjectURL(file)
    setPhotoThumbs((prev) => [...prev, url])
  }

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach((f) => addLabelPhoto(f))
      setShowPhotoMenu(false)
      e.target.value = ''
    }
  }

  const removeLabelPhoto = (index: number) => {
    URL.revokeObjectURL(photoThumbs[index])
    setLabelPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoThumbs((prev) => prev.filter((_, i) => i !== index))
  }

  const processAllPhotos = async () => {
    if (labelPhotos.length === 0) {
      toast('Add at least one photo first.', 'tw')
      return
    }
    setIsLooking(true)
    toast(labelPhotos.length > 1 ? `Reading ${labelPhotos.length} label photos...` : 'Reading label...', 'ts')
    try {
      const result = await extractFromImages(labelPhotos, consented)
      const conf = result.confidence ?? 0.5
      const hasUsefulData = Boolean(
        result.name?.trim() || result.dosage?.trim() || result.instructions?.trim() || result.warnings?.trim()
      )
      if (!hasUsefulData) {
        toast("Couldn't read enough from the label. Please enter manually.", 'tw')
        return
      }
      if (conf < 0.6) {
        setPendingExtract(result as typeof pendingExtract)
        setShowVerifyModal(true)
      } else {
        applyExtractToForm(result)
        toast('Label info loaded. Please verify before saving.', 'ts')
      }
      // Clear photos after successful processing
      photoThumbs.forEach((url) => URL.revokeObjectURL(url))
      setLabelPhotos([])
      setPhotoThumbs([])
    } catch (e) {
      handleMutationError(e, 'label-extract', "Couldn't read the label. Please enter manually.", toast)
    } finally {
      setIsLooking(false)
    }
  }

  const handleVerifyConfirm = () => {
    if (pendingExtract) {
      applyExtractToForm(pendingExtract)
      toast('Label info loaded. Please verify before saving.', 'ts')
    }
    setShowVerifyModal(false)
    setPendingExtract(null)
  }

  const handleVerifyEdit = () => {
    setShowVerifyModal(false)
    setPendingExtract(null)
    toast("Please enter details manually below.", 'tw')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const f = Number.parseInt(freq, 10) || 1

    try {
      await createBundleAsync({
        medication: {
          name,
          dosage: dose,
          freq: f,
          instructions: inst,
          warnings: warn,
          color: 'sky',
          icon: 'pill',
          rxcui: rxcui ?? undefined,
        },
        schedules: times.map((t) => ({
          time: t,
          days: [0, 1, 2, 3, 4, 5, 6],
          food_context_minutes: 0,
          active: true,
        })),
        refill: {
          current_quantity: Number.parseInt(sup, 10) || 30,
          total_quantity: Number.parseInt(sup, 10) || 30,
          refill_date: null,
          pharmacy: null,
        },
      })
      onClose()
    } catch {
      // Error already handled by mutation's onError callback (toast shown)
      // Don't close modal so user can retry
    }
  }

  // Deduplicate appointment conflicts by apptTitle+medTime
  const uniqueApptConflicts = apptConflicts.filter(
    (c, i, arr) => arr.findIndex((x) => x.apptTitle === c.apptTitle && x.medTime === c.medTime) === i
  )

  return (
    <>
      {/* File inputs portalled to body — must be outside Modal's CSS transform context
         so that programmatic .click() reliably opens the file picker across all browsers */}
      {createPortal(
        <>
          <input
            id={labelPhotoInputId}
            ref={labelPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            aria-label="Choose photos from library"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px' }}
            onChange={handlePhotoInputChange}
          />
          <input
            id={cameraInputId}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take a photo with camera"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px' }}
            onChange={handlePhotoInputChange}
          />
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            aria-label="Choose files"
            style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px' }}
            onChange={handlePhotoInputChange}
          />
        </>,
        document.body
      )}
      <Modal open onOpenChange={(o) => !o && onClose()} title="Add Medication" variant="responsive" onInteractOutside={(e) => { if (showPhotoMenu) e.preventDefault() }}>
        <>

            {/* Shared photo source menu — portalled to body to escape modal's CSS transform stacking context */}
            {showPhotoMenu && menuRect && createPortal(
              (() => {
                const minW = 240
                const vw = window.innerWidth
                const w = Math.max(menuRect.width, minW)
                const left = Math.min(menuRect.left, vw - w - 8)
                return (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowPhotoMenu(false)} aria-hidden />
                    <div
                      className="fixed z-[9999] rounded-2xl overflow-hidden shadow-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]"
                      style={{ top: menuRect.bottom + 6, left, width: w }}
                    >
                      <button
                        type="button"
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] [font-size:var(--text-body)] cursor-pointer border-none bg-transparent"
                        onClick={() => { setShowPhotoMenu(false); openHiddenFileInput(labelPhotoInputRef.current) }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                        Photo Library
                      </button>
                      <div className="h-px bg-[var(--color-border-primary)]" />
                      {isMobile() ? (
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-5 py-4 text-left font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] [font-size:var(--text-body)] cursor-pointer border-none bg-transparent"
                          onClick={() => { setShowPhotoMenu(false); openHiddenFileInput(cameraInputRef.current) }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden>
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                          </svg>
                          Take Photo
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-5 py-4 text-left font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] [font-size:var(--text-body)] cursor-pointer border-none bg-transparent"
                          onClick={() => {
                            void openCameraModal()
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden>
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                          </svg>
                          Take Photo
                        </button>
                      )}
                      <div className="h-px bg-[var(--color-border-primary)]" />
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-5 py-4 text-left font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] [font-size:var(--text-body)] cursor-pointer border-none bg-transparent"
                        onClick={() => { setShowPhotoMenu(false); openHiddenFileInput(fileInputRef.current) }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden>
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        Choose Files
                      </button>
                    </div>
                  </>
                )
              })(),
              document.body
            )}

            {/* Photo thumbnails */}
            {photoThumbs.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    {labelPhotos.length} photo{labelPhotos.length !== 1 ? 's' : ''} added
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    (up to 5 — add multiple sides of the bottle)
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {photoThumbs.map((thumb, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shrink-0">
                      <img src={thumb} alt={`Label photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeLabelPhoto(i)}
                        className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--color-red)] text-white rounded-full flex items-center justify-center text-xs font-bold cursor-pointer shadow-sm"
                        aria-label={`Remove photo ${i + 1}`}
                      >×</button>
                    </div>
                  ))}
                  {labelPhotos.length < 5 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        setMenuRect(rect)
                        setShowPhotoMenu((v) => !v)
                      }}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--color-border-secondary)] flex items-center justify-center text-[var(--color-text-tertiary)] cursor-pointer hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                      aria-label="Add another photo"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { void processAllPhotos() }}
                  disabled={isLooking || labelPhotos.length === 0}
                  className="mt-2 w-full py-3 px-6 rounded-2xl font-bold text-white bg-[var(--color-accent)] cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 [font-size:var(--text-body)]"
                >
                  {isLooking ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-2 border-t-white rounded-full spin-loading shrink-0" />
                      <span>{`Reading ${labelPhotos.length > 1 ? `${labelPhotos.length} photos` : 'label'}...`}</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      <span>{`Process ${labelPhotos.length > 1 ? `${labelPhotos.length} photos` : 'photo'}`}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Label photo button — shown when no photos loaded yet */}
            {labelPhotos.length === 0 && (
              canUseOcr ? (
                <button
                  ref={photoMenuBtnRef}
                  type="button"
                  onClick={() => {
                    const rect = photoMenuBtnRef.current?.getBoundingClientRect() ?? null
                    setMenuRect(rect)
                    setShowPhotoMenu((v) => !v)
                  }}
                  disabled={isLooking}
                  aria-label="Take or upload photos of prescription label"
                  aria-busy={isLooking}
                  aria-live="polite"
                  className="w-full py-3 px-4 mb-3 rounded-2xl font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 [font-size:var(--text-body)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>📸 Label photo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/subscription')}
                  className="w-full py-3 px-4 mb-3 rounded-2xl font-semibold text-[var(--color-text-tertiary)] border border-dashed border-[var(--color-border-primary)] cursor-pointer opacity-60 hover:opacity-80 transition-opacity flex items-center justify-center gap-2 [font-size:var(--text-body)]"
                  aria-label="Label photo — requires Basic — tap to upgrade"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Label photo — requires Basic</span>
                </button>
              )
            )}
            <p className="text-[var(--color-text-tertiary)] text-xs mb-4 -mt-1 px-1">
              {canUseOcr
                ? 'Photograph all sides of your pill bottle for best results. You can add up to 5 photos.'
                : 'Photo label scanning requires Basic or Pro.'}
            </p>
          </>

        {/* Desktop camera capture modal */}
        {showCameraModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-lg bg-[var(--color-bg-primary)] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-primary)]">
                <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">Take Photo</span>
                <button type="button" onClick={closeCameraModal} aria-label="Close camera" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] cursor-pointer border-none bg-transparent text-xl">×</button>
              </div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video bg-black object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="p-4 flex justify-center">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white border-4 border-[var(--color-accent)] flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 transition-transform"
                  aria-label="Capture photo"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
          <span className="font-semibold text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">Or enter manually</span>
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          {/* Name */}
          <div>
            <label htmlFor="med-name" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Name</label>
            <Input
              id="med-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { void handleNameBlur() }}
              placeholder="e.g. Amoxicillin"
              aria-busy={isLookingUpRxcui}
              required
            />
          </div>

          {/* Dosage | Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="med-dosage" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Dosage</label>
              <Input id="med-dosage" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 500mg" />
            </div>
            <div>
              <label htmlFor="med-freq" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Frequency</label>
              <select className="fi w-full" id="med-freq" value={freq} onChange={(e) => handleFreqChange(e.target.value)}>
                <option value="1">Once daily</option>
                <option value="2">Twice daily</option>
                <option value="3">Three times</option>
              </select>
            </div>
          </div>

          {/* Schedule & Supply */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Schedule & Supply</span>
              <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {times.map((t, i) => (
                <div key={i}>
                  <label htmlFor={`med-time-${i}`} className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
                    {times.length > 1 ? `Time ${i + 1}` : 'Time'}
                  </label>
                  <Input id={`med-time-${i}`} type="time" value={t} onChange={(e) => updateTimeAtIndex(i, e.target.value)} />
                </div>
              ))}
              <div>
                <label htmlFor="med-sup" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Pills in Bottle</label>
                <Input id="med-sup" type="number" value={sup} onChange={(e) => setSup(e.target.value)} min={0} />
              </div>
            </div>
          </div>

          {/* Appointment conflict warnings */}
          {uniqueApptConflicts.length > 0 && (
            <div className="rounded-xl border border-[var(--color-amber,#d97706)] bg-[color-mix(in_srgb,var(--color-amber,#d97706)_10%,transparent)] px-4 py-3 flex flex-col gap-1" role="alert">
              {uniqueApptConflicts.map((c, i) => (
                <p key={i} className="text-[var(--color-amber,#d97706)] font-semibold [font-size:var(--text-label)]">
                  ⚠️ {c.apptTitle} is at {c.apptTime} — this time may conflict with your appointment
                </p>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div>
            <label htmlFor="med-inst" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Instructions</label>
            <textarea
              id="med-inst"
              value={inst}
              onChange={(e) => setInst(e.target.value)}
              placeholder="e.g. Take with food"
              rows={inst.length > 80 ? 4 : 2}
              className="fi w-full resize-y min-h-[2.5rem]"
            />
          </div>

          {/* Warnings */}
          <div>
            <label htmlFor="med-warn" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Warnings</label>
            <textarea
              id="med-warn"
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
              placeholder="e.g. May cause drowsiness"
              rows={warn.length > 80 ? 4 : 2}
              className="fi w-full resize-y min-h-[2.5rem]"
            />
          </div>

          {/* Food interaction note */}
          {foodNote && (
            <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-3 flex items-start gap-3" role="note">
              <span className="text-base shrink-0">💊</span>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] leading-snug">
                  <span className="font-semibold">Food note:</span> {foodNote}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWarn((prev) => prev ? `${prev}\n${foodNote}` : foodNote)
                  setFoodNote(null)
                }}
                className="shrink-0 text-xs font-semibold text-[var(--color-accent)] underline cursor-pointer whitespace-nowrap"
              >
                Add to warnings
              </button>
            </div>
          )}

          {/* Allergy warning banner */}
          {allergyWarning && (
            <div
              className="rounded-xl border border-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_10%,transparent)] px-4 py-3 flex items-start gap-3"
              role="alert"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[var(--color-red)] font-semibold [font-size:var(--text-label)] leading-snug">
                {allergyWarning}
              </p>
              <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mt-1">
                Always consult your pharmacist or healthcare provider before making any medication decisions.
              </p>
            </div>
          )}

          {/* Drug interaction warning banner */}
          {interactions.length > 0 && (
            <div
              className={`rounded-xl border px-4 py-3 flex flex-col gap-2 ${
                interactions.some((i: DrugInteraction) => i.severity === 'high')
                  ? 'border-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_10%,transparent)]'
                  : 'border-[var(--color-amber,#d97706)] bg-[color-mix(in_srgb,var(--color-amber,#d97706)_10%,transparent)]'
              }`}
              role="alert"
            >
              <p className={`font-bold [font-size:var(--text-label)] ${
                interactions.some((i: DrugInteraction) => i.severity === 'high')
                  ? 'text-[var(--color-red)]'
                  : 'text-[var(--color-amber,#d97706)]'
              }`}>
                ⚠️ Drug Interaction{interactions.length > 1 ? 's' : ''} Detected
              </p>
              {interactions.map((interaction: DrugInteraction, idx: number) => (
                <p
                  key={idx}
                  className={`[font-size:var(--text-label)] leading-snug ${
                    interaction.severity === 'high'
                      ? 'text-[var(--color-red)]'
                      : 'text-[var(--color-amber,#d97706)]'
                  }`}
                >
                  {interaction.description}
                </p>
              ))}
              <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mt-2">
                Review these interactions with your pharmacist or healthcare provider before taking this medication.
              </p>
            </div>
          )}

          <Button type="submit" variant="primary" size="md" className="mt-1" disabled={isSaving || isLooking}>
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-2 border-t-white rounded-full spin-loading shrink-0" />
                Saving...
              </span>
            ) : (
              'Add Medication'
            )}
          </Button>
        </form>
      </Modal>

      {showVerifyModal && pendingExtract && (
        <Modal open onOpenChange={(o) => !o && handleVerifyEdit()} title="Verify extracted details" variant="center">
          <p className="text-[var(--color-text-secondary)] mb-4 [font-size:var(--text-body)]">
            Please verify these details against your label.
          </p>
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 mb-4 space-y-2 text-sm" role="region" aria-label="Extracted medication summary">
            {pendingExtract.name && <p><strong>Name:</strong> {pendingExtract.name}</p>}
            {pendingExtract.dosage && <p><strong>Dosage:</strong> {pendingExtract.dosage}</p>}
            {pendingExtract.freq != null && <p><strong>Frequency:</strong> {pendingExtract.freq}x daily</p>}
            {pendingExtract.time && <p><strong>Time:</strong> {pendingExtract.time}</p>}
            {pendingExtract.quantity != null && <p><strong>Quantity:</strong> {pendingExtract.quantity}</p>}
            {pendingExtract.instructions && <p><strong>Instructions:</strong> {pendingExtract.instructions}</p>}
            {pendingExtract.warnings && <p><strong>Warnings:</strong> {pendingExtract.warnings}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="md" onClick={handleVerifyConfirm}>
              Confirm
            </Button>
            <Button variant="ghost" size="md" onClick={handleVerifyEdit}>
              Edit manually
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
