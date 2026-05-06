import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, type QuerySnapshot, type DocumentData } from 'firebase/firestore'
import type { DonationEvent, UserSettings } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import { getDonationSound } from '../utils/getDonationSound'
import moedaGif from '../assets/images/gifs/moeda_mario.gif'
import dinheiroAsaGif from '../assets/images/gifs/cash.gif'
import montanteGif from '../assets/images/gifs/montante.gif'

const DEFAULT_COLOR = '#00FF88'
const DEFAULT_DURATION = 5

function getDonationGif(amount: number) {
  if (amount <= 10) return moedaGif
  if (amount <= 49) return dinheiroAsaGif
  return montanteGif
}

export default function Overlay() {
  const { userId } = useParams<{ userId: string }>()
  const [active, setActive] = useState<(DonationEvent & { id: string }) | null>(null)
  const [exiting, setExiting] = useState(false)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [videoSoundLocked, setVideoSoundLocked] = useState(false)

  const queueRef = useRef<(DonationEvent & { id: string })[]>([])
  const processingRef = useRef(false)
  const completedRef = useRef(false)
  const finishingRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enableSound = useCallback(() => {
    setSoundEnabled(true)
  }, [])

  const unlockVideoSound = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false
      videoRef.current.volume = 1
      videoRef.current.play().catch(() => {})
    }
    setVideoSoundLocked(false)
  }, [])

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const completeDonation = useCallback(async (donation: DonationEvent & { id: string }) => {
    if (finishingRef.current) return
    finishingRef.current = true

    clearAllTimers()

    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'donations', donation.id), { displayed: true })
    } catch {
      // silently fail
    }
    processingRef.current = false
    setActive(null)
    setExiting(false)
    setVideoSoundLocked(false)
    finishingRef.current = false

    setTimeout(() => processQueue(), 100)
  }, [userId, clearAllTimers])

  const handleMediaEnd = useCallback(() => {
    if (completedRef.current || !active) return
    completedRef.current = true
    setExiting(true)
    completeDonation(active)
  }, [active, completeDonation])

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return
    processingRef.current = true
    completedRef.current = false
    finishingRef.current = false

    const next = queueRef.current.shift()!
    setActive(next)
    setExiting(false)
    setVideoSoundLocked(false)

    const duration = (settings?.duration ?? DEFAULT_DURATION) * 1000

    if (next.type === 'text') {
      timerRef.current = setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        setExiting(true)
        completeDonation(next)
      }, duration)
    } else if (next.type === 'audio') {
      if (!next.audioUrl) {
        timerRef.current = setTimeout(() => {
          if (completedRef.current) return
          completedRef.current = true
          setExiting(true)
          completeDonation(next)
        }, duration)
      } else {
        fallbackTimerRef.current = setTimeout(() => {
          if (completedRef.current) return
          console.warn('Fallback: áudio demorou demais, finalizando')
          completedRef.current = true
          setExiting(true)
          completeDonation(next)
        }, 120000)
      }
    } else if (next.type === 'video') {
      if (!next.videoUrl) {
        timerRef.current = setTimeout(() => {
          if (completedRef.current) return
          completedRef.current = true
          setExiting(true)
          completeDonation(next)
        }, duration)
      } else {
        fallbackTimerRef.current = setTimeout(() => {
          if (completedRef.current) return
          console.warn('Fallback: vídeo demorou demais, finalizando')
          completedRef.current = true
          setExiting(true)
          completeDonation(next)
        }, 300000)
      }
    }
  }, [settings?.duration, completeDonation])

  useEffect(() => {
    finishingRef.current = false
    completedRef.current = false

    if (active?.type === 'audio' && audioRef.current && active.audioUrl) {
      audioRef.current.src = active.audioUrl
      audioRef.current.muted = false
      audioRef.current.volume = 1
      audioRef.current.play()
        .then(() => setVideoSoundLocked(false))
        .catch(() => {
          console.warn('Autoplay áudio bloqueado, aguardando interação')
        })
    }

    if (active?.type === 'video' && videoRef.current && active.videoUrl) {
      videoRef.current.src = active.videoUrl
      videoRef.current.muted = false
      videoRef.current.volume = 1
      videoRef.current.play()
        .then(() => setVideoSoundLocked(false))
        .catch(() => setVideoSoundLocked(true))
    }
  }, [active?.id])

  useEffect(() => {
    if (!active || !soundEnabled) return

    const amount = typeof active.amount === 'number' ? active.amount : Number(active.amount) || 0
    const soundPath = getDonationSound(amount)
    const audio = new Audio(soundPath)
    audio.volume = 1

    audio.play().catch((error) => {
      console.warn('Som do donate bloqueado pelo navegador:', error)
    })

    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [active?.id, soundEnabled])

  useEffect(() => {
    if (!userId) return

    const settingsDoc = doc(db, 'users', userId, 'settings', 'main')
    const unsubSettings = onSnapshot(settingsDoc, snap => {
      if (snap.exists()) {
        setSettings(snap.data() as UserSettings)
      }
    })

    const donationsCol = collection(db, 'users', userId, 'donations')
    const q = query(donationsCol, where('status', '==', 'paid'), where('displayed', '==', false), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      if (snapshot.empty) return

      const existingIds = new Set(queueRef.current.map(d => d.id))
      if (active) existingIds.add(active.id)

      let hasNew = false
      for (const docSnap of snapshot.docs) {
        const data = { id: docSnap.id, ...docSnap.data() } as DonationEvent & { id: string }
        const showTest = data.isTest === true
        const showReal = data.isTest !== true

        if ((showTest || showReal) && !seenIdsRef.current.has(docSnap.id) && !existingIds.has(docSnap.id)) {
          queueRef.current.push(data)
          seenIdsRef.current.add(docSnap.id)
          hasNew = true
        }
      }

      if (hasNew && !processingRef.current) {
        processQueue()
      }
    })

    return () => {
      unsub()
      unsubSettings()
    }
  }, [userId, processQueue])

  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  if (!userId || !settings) return null

  if (!soundEnabled) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black/90 flex items-center justify-center pointer-events-auto">
        <button
          onClick={enableSound}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-neon/20 bg-surface/60 backdrop-blur-sm hover:border-neon/40 hover:bg-neon/5 transition-all duration-300 group"
        >
          <div className="w-16 h-16 rounded-full bg-neon/10 flex items-center justify-center group-hover:bg-neon/20 transition-colors">
            <svg className="w-8 h-8 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-offwhite">Clique para ativar</div>
            <div className="text-sm text-sage mt-1">Permite sons e alertas do overlay</div>
          </div>
        </button>
      </div>
    )
  }

  const primaryColor = settings.primaryColor || DEFAULT_COLOR

  return (
    <div className="fixed inset-0 w-screen h-screen pointer-events-none overflow-hidden flex items-end justify-center pb-24">
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
        onEnded={handleMediaEnd}
        onError={() => {
          console.warn('Erro ao carregar áudio do overlay')
          handleMediaEnd()
        }}
      />
      <video
        ref={videoRef}
        preload="auto"
        className="hidden"
        playsInline
        onEnded={handleMediaEnd}
        onError={() => {
          console.warn('Erro ao carregar vídeo do overlay')
          handleMediaEnd()
        }}
      />

      {active && (
        <div
          className={`max-w-xl w-full mx-6 p-6 rounded-2xl backdrop-blur-xl border transition-all duration-500 relative ${
            exiting ? 'alert-exit' : 'alert-enter'
          }`}
          style={{
            backgroundColor: 'rgba(5, 8, 7, 0.85)',
            borderColor: `${primaryColor}40`,
            boxShadow: `0 0 40px ${primaryColor}30, 0 0 80px ${primaryColor}10, 0 8px 32px rgba(0, 0, 0, 0.4)`,
          }}
        >
          {active.type === 'video' && videoSoundLocked && (
            <button
              onClick={unlockVideoSound}
              className="absolute top-3 right-3 pointer-events-auto z-50 px-3 py-1.5 rounded-lg bg-black/70 text-sage text-xs font-medium border border-border hover:text-neon hover:border-neon/30 transition-colors backdrop-blur-sm"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                Ativar som
              </span>
            </button>
          )}

          {active.type === 'video' && active.videoUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-border">
              <video
                src={active.videoUrl}
                autoPlay
                playsInline
                controls
                className="w-full max-h-48 object-contain bg-black/50"
                onEnded={handleMediaEnd}
                onError={() => {
                  console.warn('Erro ao reproduir vídeo visível')
                  handleMediaEnd()
                }}
              />
            </div>
          )}

          <div className="flex items-start gap-5">
            {active.type !== 'video' && (
              <img
                src={getDonationGif(active.amount)}
                alt="donation animation"
                className="w-[100px] h-[100px] object-contain rounded-xl shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold text-offwhite tracking-tight leading-tight">
                <span className="text-sage text-base font-normal mr-1">Doação de</span>
                {active.donorName || 'Anônimo'}
              </div>
              <div className="text-3xl font-black mt-1 tracking-tight" style={{ color: primaryColor }}>
                {formatCurrency(Number(active.amount) || 0)}
              </div>

              {active.type === 'text' && active.message && (
                <div className="text-sage text-base mt-2 break-words" title={active.message}>
                  &ldquo;{active.message}&rdquo;
                </div>
              )}

              {active.type === 'audio' && active.audioUrl && (
                <div className="mt-3">
                  <audio
                    src={active.audioUrl}
                    controls
                    autoPlay
                    className="w-full max-w-xs rounded-lg"
                    onEnded={handleMediaEnd}
                    onError={() => {
                      console.warn('Erro ao reproduzir áudio visível')
                      handleMediaEnd()
                    }}
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: primaryColor }}>
                  {settings.alertText}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
