import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, type QuerySnapshot, type DocumentData } from 'firebase/firestore'
import type { DonationEvent, UserSettings } from '../types'
import { THEMES as THEME_CONFIG } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import { getDonationSound } from '../utils/getDonationSound'
import { devLog, devWarn, devError } from '../utils/devLogger'
import moedaGif from '../assets/images/gifs/moeda_mario.gif'
import dinheiroAsaGif from '../assets/images/gifs/cash.gif'
import montanteGif from '../assets/images/gifs/montante.gif'

const DEFAULT_DURATION = 5

function getDonationGif(amount: number) {
  if (amount <= 10) return moedaGif
  if (amount <= 49) return dinheiroAsaGif
  return montanteGif
}

export default function Overlay() {
  const { userId } = useParams<{ userId: string }>()
  const [active, setActive] = useState<(DonationEvent & { id: string }) | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [videoSoundLocked, setVideoSoundLocked] = useState(false)
  const [progress, setProgress] = useState(0)

  const queueRef = useRef<(DonationEvent & { id: string })[]>([])
  const processingRef = useRef(false)
  const completedRef = useRef(false)
  const finishingRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playedAudioRef = useRef<string | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextMediaRef = useRef<{ audioUrl?: string; videoUrl?: string } | null>(null)

  const enableSound = useCallback(() => {
    setSoundEnabled(true)
    devLog('overlay', 'Sound enabled by user interaction')
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
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const startProgress = useCallback((durationMs: number) => {
    setProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)

    const interval = 100
    const increment = (interval / durationMs) * 100

    progressTimerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + increment
        if (next >= 100) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current)
          return 100
        }
        return next
      })
    }, interval)
  }, [])

  const completeDonation = useCallback(async (donation: DonationEvent & { id: string }) => {
    if (finishingRef.current) return
    finishingRef.current = true

    clearAllTimers()
    setProgress(0)

    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'donations', donation.id), { displayed: true, status: 'played' })
      devLog('overlay', `Donation ${donation.id} marked as played`)
    } catch (err) {
      devError('overlay', 'Failed to update donation', err)
    }
    processingRef.current = false
    setActive(null)
    setVideoSoundLocked(false)
    finishingRef.current = false
    playedAudioRef.current = null

    setTimeout(() => processQueueRef.current?.(), 100)
  }, [userId, clearAllTimers])

  const handleMediaEnd = useCallback(() => {
    if (completedRef.current || !active) return
    completedRef.current = true
    devLog('overlay', `Media ended for donation ${active.id}`)
    completeDonation(active)
  }, [active, completeDonation])

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return
    processingRef.current = true
    completedRef.current = false
    finishingRef.current = false

    const next = queueRef.current.shift()!
    setActive(next)
    setVideoSoundLocked(false)

    const duration = (settings?.duration ?? DEFAULT_DURATION) * 1000

    if (next.type === 'text') {
      startProgress(duration)
      timerRef.current = setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        completeDonation(next)
      }, duration)
    } else if (next.type === 'audio') {
      if (!next.audioUrl) {
        startProgress(duration)
        timerRef.current = setTimeout(() => {
          if (completedRef.current) return
          completedRef.current = true
          completeDonation(next)
        }, duration)
      } else {
        fallbackTimerRef.current = setTimeout(() => {
          if (completedRef.current) return
          devWarn('overlay', 'Fallback: audio took too long')
          completedRef.current = true
          completeDonation(next)
        }, 120000)
      }
    } else if (next.type === 'video') {
      if (!next.videoUrl) {
        startProgress(duration)
        timerRef.current = setTimeout(() => {
          if (completedRef.current) return
          completedRef.current = true
          completeDonation(next)
        }, duration)
      } else {
        fallbackTimerRef.current = setTimeout(() => {
          if (completedRef.current) return
          devWarn('overlay', 'Fallback: video took too long')
          completedRef.current = true
          completeDonation(next)
        }, 300000)
      }
    }

    if (queueRef.current.length > 0) {
      const upcoming = queueRef.current[0]
      nextMediaRef.current = { audioUrl: upcoming.audioUrl, videoUrl: upcoming.videoUrl }
    }
  }, [settings?.duration, completeDonation, startProgress])

  const processQueueRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    processQueueRef.current = processQueue
  }, [processQueue])

  useEffect(() => {
    if (!active) return
    playedAudioRef.current = null
    completedRef.current = false
    finishingRef.current = false
    devLog('overlay', `Active donation: ${active.id} (${active.type})`)
  }, [active?.id])

  useEffect(() => {
    if (active?.type === 'audio' && audioRef.current && active.audioUrl) {
      if (playedAudioRef.current === active.id) return
      playedAudioRef.current = active.id

      audioRef.current.src = active.audioUrl
      audioRef.current.muted = false
      audioRef.current.volume = 1
      audioRef.current.play()
        .then(() => {
          setVideoSoundLocked(false)
          devLog('overlay', 'Audio playback started')
        })
        .catch((err) => {
          devWarn('overlay', 'Audio autoplay blocked', err)
        })
    }

    if (active?.type === 'video' && videoRef.current && active.videoUrl) {
      videoRef.current.src = active.videoUrl
      videoRef.current.muted = false
      videoRef.current.volume = 1
      videoRef.current.play()
        .then(() => {
          setVideoSoundLocked(false)
          devLog('overlay', 'Video playback started')
        })
        .catch(() => {
          setVideoSoundLocked(true)
          devWarn('overlay', 'Video autoplay blocked')
        })
    }
  }, [active?.id])

  useEffect(() => {
    if (!active || !soundEnabled) return

    const amount = typeof active.amount === 'number' ? active.amount : Number(active.amount) || 0
    const soundPath = getDonationSound(amount)
    const audio = new Audio(soundPath)
    audio.volume = 1

    audio.play().catch((error) => {
      devWarn('overlay', 'Donation sound blocked', error)
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
        if (!seenIdsRef.current.has(docSnap.id) && !existingIds.has(docSnap.id)) {
          queueRef.current.push(data)
          seenIdsRef.current.add(docSnap.id)
          hasNew = true
          devLog('overlay', `New donation queued: ${docSnap.id}`)
        }
      }

      if (hasNew && !processingRef.current) {
        processQueueRef.current?.()
      }
    })

    return () => {
      unsub()
      unsubSettings()
    }
  }, [userId])

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

  const theme = THEME_CONFIG[settings.theme || 'neon']
  const primaryColor = settings.primaryColor || theme.primaryColor
  const bgColor = theme.bgColor
  const borderColor = settings.primaryColor ? `${settings.primaryColor}40` : theme.borderColor
  const shadowColor = settings.primaryColor ? `${settings.primaryColor}30` : theme.shadowColor

  const fontSizeClass = settings.fontSize === 'sm' ? 'text-base' : settings.fontSize === 'lg' ? 'text-2xl' : 'text-lg'
  const amountSizeClass = settings.fontSize === 'sm' ? 'text-2xl' : settings.fontSize === 'lg' ? 'text-4xl' : 'text-3xl'
  const cardPadding = settings.cardSize === 'compact' ? 'p-4' : settings.cardSize === 'large' ? 'p-8' : 'p-6'

  const positionClasses = {
    'bottom-center': 'items-end justify-center pb-24',
    'top-center': 'items-start justify-center pt-24',
    'bottom-left': 'items-end justify-start pb-24 pl-24',
    'bottom-right': 'items-end justify-end pb-24 pr-24',
    'top-left': 'items-start justify-start pt-24 pl-24',
    'top-right': 'items-start justify-end pt-24 pr-24',
  }

  return (
    <div className={`fixed inset-0 w-screen h-screen pointer-events-none overflow-hidden flex ${positionClasses[settings.overlayPosition || 'bottom-center']}`}>
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
        onEnded={handleMediaEnd}
        onError={() => {
          devWarn('overlay', 'Error loading audio')
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
          devWarn('overlay', 'Error loading hidden video')
          handleMediaEnd()
        }}
      />

      {active && (
        <div
          className={`max-w-xl w-full mx-6 ${cardPadding} rounded-2xl backdrop-blur-xl border transition-all duration-500 relative overflow-hidden`}
          style={{
            backgroundColor: bgColor,
            borderColor,
            boxShadow: `0 0 40px ${shadowColor}, 0 0 80px ${shadowColor.replace('0.3', '0.1')}, 0 8px 32px rgba(0, 0, 0, 0.4)`,
          }}
        >
          {progress > 0 && progress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
              <div
                className="h-full transition-all duration-100"
                style={{ width: `${progress}%`, backgroundColor: primaryColor }}
              />
            </div>
          )}

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
                  devWarn('overlay', 'Error playing visible video')
                  handleMediaEnd()
                }}
              />
            </div>
          )}

          <div className="flex items-start gap-5">
            {settings.gifEnabled !== false && active.type !== 'video' && (
              <img
                src={getDonationGif(active.amount)}
                alt="donation animation"
                className="w-[100px] h-[100px] object-contain rounded-xl shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className={`${fontSizeClass} font-bold text-offwhite tracking-tight leading-tight`}>
                <span className="text-sage text-sm font-normal mr-1">Doação de</span>
                {active.donorName || 'Anônimo'}
              </div>
              <div className={`${amountSizeClass} font-black mt-1 tracking-tight`} style={{ color: primaryColor }}>
                {formatCurrency(Number(active.amount) || 0)}
              </div>

              {active.type === 'text' && active.message && (
                <div className={`text-sage mt-2 break-words ${fontSizeClass}`} title={active.message}>
                  &ldquo;{active.message}&rdquo;
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
