import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { uploadToCloudinary } from '../services/cloudinary'
import type { UserSettings, DonationType, PaymentStatus } from '../types'
import { MIN_AMOUNTS, DONATION_LABELS } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import { validateText, validateAudioFile, validateVideoFile, validateMediaDuration, MAX_AUDIO_DURATION, MAX_VIDEO_DURATION } from '../utils/validation'
import { devLog, devWarn, devError } from '../utils/devLogger'
import DonationTypeCard from '../components/send/DonationTypeCard'
import MediaRecorderComponent from '../components/send/MediaRecorder'
import PixPayment from '../components/send/PixPayment'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const ENABLE_MANUAL_CONFIRM = import.meta.env.VITE_ENABLE_MANUAL_CONFIRM === 'true'

type PaymentStep = 'form' | 'payment' | 'confirmed' | 'expired' | 'failed'

export default function SendDonation() {
  const { streamerId } = useParams<{ streamerId: string }>()
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedType, setSelectedType] = useState<DonationType | null>(null)
  const [donorName, setDonorName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)

  const [paymentStep, setPaymentStep] = useState<PaymentStep>('form')
  const [donationId, setDonationId] = useState<string | null>(null)
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [creatingDonation, setCreatingDonation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [qrCode, setQrCode] = useState('')
  const [pixCopiaECola, setPixCopiaECola] = useState('')
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const unsubRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isStreamerOwner = ENABLE_MANUAL_CONFIRM && user && user.uid === streamerId

  useEffect(() => {
    if (!streamerId) return

    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'users', streamerId, 'settings', 'main')
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          setSettings(snap.data() as UserSettings)
        }
      } catch (err) {
        devError('send', 'Failed to load settings', err)
      }
      setLoading(false)
    }
    loadSettings()
  }, [streamerId])

  useEffect(() => {
    if (!streamerId || !donationId) return

    if (unsubRef.current) {
      unsubRef.current()
    }

    const docRef = doc(db, 'users', streamerId, 'donations', donationId)

    unsubRef.current = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setStatus(data.status || 'pending')
        devLog('send', `Donation status updated: ${data.status}`)

        if (data.status === 'paid') {
          setPaymentStep('confirmed')
        } else if (data.status === 'expired') {
          setPaymentStep('expired')
        } else if (data.status === 'failed') {
          setPaymentStep('failed')
        }
      }
    }, (err) => {
      devError('send', 'Erro ao ouvir doação', err)
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [streamerId, donationId])

  useEffect(() => {
    if (status === 'pending' && donationId) {
      setTimeLeft(1800)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status, donationId])

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleBlobReady = useCallback((_blob: Blob, _previewUrl: string, file?: File) => {
    setMediaBlob(_blob)
    setMediaFile(file || null)
  }, [])

  const handleMediaClear = useCallback(() => {
    setMediaBlob(null)
    setMediaFile(null)
  }, [])

  const handleCopyPix = useCallback(async () => {
    const textToCopy = pixCopiaECola || qrCode
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
      devLog('send', 'Pix code copied')
    } catch {
      devWarn('send', 'Failed to copy pix code')
    }
  }, [pixCopiaECola, qrCode])

  const handleConfirmPayment = useCallback(async () => {
    if (!streamerId || !donationId) return

    setConfirmingPayment(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/admin/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId,
          streamerId,
          adminToken: import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-token',
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errData.error || 'Erro ao confirmar pagamento')
      }

      devLog('send', 'Payment confirmed manually (DEV mode)')
    } catch (err) {
      devError('send', 'Erro ao confirmar pagamento', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Erro ao confirmar: ${msg}`)
    } finally {
      setConfirmingPayment(false)
    }
  }, [streamerId, donationId])

  const handleCreateDonation = useCallback(async () => {
    if (!streamerId || !selectedType || !settings) return

    setError(null)
    const minAmount = MIN_AMOUNTS[selectedType]
    const parsedAmount = parseFloat(amount)

    if (!donorName.trim()) {
      setError('Digite seu nome')
      return
    }

    const nameValidation = validateText(donorName.trim(), 50, 1)
    if (!nameValidation.valid) {
      setError(nameValidation.error || 'Nome inválido')
      return
    }

    if (isNaN(parsedAmount) || parsedAmount < minAmount) {
      setError(`Valor mínimo para ${DONATION_LABELS[selectedType].title} é ${formatCurrency(minAmount)}`)
      return
    }

    if (parsedAmount > 10000) {
      setError('Valor máximo permitido é R$ 10.000,00')
      return
    }

    if (selectedType === 'text') {
      if (!message.trim()) {
        setError('Digite uma mensagem')
        return
      }
      const textValidation = validateText(message.trim(), 200, 1)
      if (!textValidation.valid) {
        setError(textValidation.error || 'Mensagem inválida')
        return
      }
    }

    if (selectedType !== 'text' && !mediaBlob) {
      setError(selectedType === 'audio' ? 'Grave ou envie um áudio' : 'Grave ou envie um vídeo')
      return
    }

    if (mediaFile) {
      if (selectedType === 'audio') {
        const fileValidation = validateAudioFile(mediaFile)
        if (!fileValidation.valid) {
          setError(fileValidation.error || 'Arquivo de áudio inválido')
          return
        }
        const durationValidation = await validateMediaDuration(mediaFile, MAX_AUDIO_DURATION)
        if (!durationValidation.valid) {
          setError(durationValidation.error || 'Áudio muito longo')
          return
        }
      } else if (selectedType === 'video') {
        const fileValidation = validateVideoFile(mediaFile)
        if (!fileValidation.valid) {
          setError(fileValidation.error || 'Arquivo de vídeo inválido')
          return
        }
        const durationValidation = await validateMediaDuration(mediaFile, MAX_VIDEO_DURATION)
        if (!durationValidation.valid) {
          setError(durationValidation.error || 'Vídeo muito longo')
          return
        }
      }
    }

    setCreatingDonation(true)

    try {
      let mediaUrl: string | null = null
      let cloudinaryPublicId: string | null = null

      if (selectedType === 'audio' && mediaBlob) {
        const file = new File([mediaBlob], `audio-${Date.now()}.webm`, {
          type: mediaBlob.type || 'audio/webm',
        })
        const result = await uploadToCloudinary(file)
        mediaUrl = result.secureUrl
        cloudinaryPublicId = result.publicId
      }

      if (selectedType === 'video' && mediaBlob) {
        const file = new File([mediaBlob], `video-${Date.now()}.webm`, {
          type: mediaBlob.type || 'video/webm',
        })
        const result = await uploadToCloudinary(file)
        mediaUrl = result.secureUrl
        cloudinaryPublicId = result.publicId
      }

      devLog('send', 'Creating donation', { type: selectedType, amount: parsedAmount })

      const response = await fetch(`${API_BASE}/api/pix/create-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId,
          amount: parsedAmount,
          type: selectedType,
          name: donorName.trim(),
          message: selectedType === 'text' ? message.trim() : '',
          mediaUrl,
          cloudinaryPublicId,
          mediaType: selectedType !== 'text' ? selectedType : undefined,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errData.error || 'Erro ao criar cobrança')
      }

      const data = await response.json()

      setDonationId(data.donationId)
      setQrCode(data.qrCode)
      setPixCopiaECola(data.pixCopiaECola)
      setStatus(data.status)
      setPaymentStep('payment')

      devLog('send', 'Donation created successfully', { donationId: data.donationId })
    } catch (err) {
      devError('send', 'Erro ao criar doação', err)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Servidor de pagamento offline. Rode `npm run dev:server` para iniciar o backend.')
      } else if (err instanceof Error) {
        setError(`Não foi possível criar a cobrança Pix: ${err.message}`)
      } else {
        setError('Não foi possível criar a cobrança Pix. Verifique a configuração do backend.')
      }
    } finally {
      setCreatingDonation(false)
    }
  }, [streamerId, selectedType, settings, donorName, amount, message, mediaBlob, mediaFile])

  const handleReset = useCallback(() => {
    setPaymentStep('form')
    setDonationId(null)
    setQrCode('')
    setPixCopiaECola('')
    setStatus('pending')
    setMediaBlob(null)
    setMediaFile(null)
    setError(null)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon/30 border-t-neon rounded-full animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-xl font-bold text-offwhite mb-2">Streamer não encontrado</div>
          <p className="text-sm text-sage">Verifique o link e tente novamente</p>
        </div>
      </div>
    )
  }

  if (paymentStep === 'confirmed') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-10 h-10 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-offwhite mb-2">Pagamento confirmado!</h2>
          <p className="text-sm text-sage mb-6">
            Sua mensagem aparecerá na live de <span className="text-neon font-semibold">{settings.streamerName}</span> em instantes.
          </p>
          <button
            onClick={handleReset}
            className="px-8 py-3 rounded-xl bg-neon/10 text-neon text-sm font-medium border border-neon/20 hover:bg-neon/20 transition-colors"
          >
            Enviar outra doação
          </button>
        </div>
      </div>
    )
  }

  if (paymentStep === 'expired') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-offwhite mb-2">Pagamento expirado</h2>
          <p className="text-sm text-sage mb-6">O tempo para pagamento acabou. Tente novamente.</p>
          <button
            onClick={handleReset}
            className="px-8 py-3 rounded-xl bg-neon/10 text-neon text-sm font-medium border border-neon/20 hover:bg-neon/20 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (paymentStep === 'failed') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-offwhite mb-2">Pagamento não confirmado</h2>
          <p className="text-sm text-sage mb-2">Não foi possível confirmar seu pagamento.</p>
          <p className="text-xs text-sage/60 mb-6">Isso pode acontecer se o valor recebido não corresponder ao esperado.</p>
          <button
            onClick={handleReset}
            className="px-8 py-3 rounded-xl bg-neon/10 text-neon text-sm font-medium border border-neon/20 hover:bg-neon/20 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const minAmount = selectedType ? MIN_AMOUNTS[selectedType] : 0

  return (
    <div className="min-h-screen bg-bg">
      <div className="fixed inset-0 bg-gradient opacity-50" />
      <div className="fixed inset-0 bg-grid-fine opacity-30" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-4 py-5 border-b border-border/50">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon/20 to-cyan/20 flex items-center justify-center overflow-hidden">
              <img src="/images/icone.png" alt="Stream Pix" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-offwhite tracking-tight">{settings.streamerName || 'Stream Pix'}</h1>
              <p className="text-xs text-sage">Envie uma doação para aparecer na live</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            {paymentStep === 'form' && (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-sage mb-3 uppercase tracking-wider">Escolha o tipo</h2>
                  <div className="space-y-2">
                    {(['text', 'audio', 'video'] as DonationType[]).map(type => (
                      <DonationTypeCard
                        key={type}
                        type={type}
                        icon={type === 'text' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                          </svg>
                        ) : type === 'audio' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        )}
                        title={DONATION_LABELS[type].title}
                        desc={DONATION_LABELS[type].desc}
                        min={DONATION_LABELS[type].min}
                        selected={selectedType === type}
                        onClick={() => {
                          setSelectedType(type)
    setMediaBlob(null)
    setMediaFile(null)
                          setMessage('')
                        }}
                      />
                    ))}
                  </div>
                </div>

                {selectedType && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-sage mb-1.5">Seu nome</label>
                      <Input
                        placeholder="Como quer aparecer na live?"
                        value={donorName}
                        onChange={e => setDonorName(e.target.value)}
                        maxLength={50}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-sage mb-1.5">
                        Valor {selectedType && <span className="text-neon">(mín. {formatCurrency(minAmount)})</span>}
                      </label>
                      <Input
                        type="number"
                        placeholder="25.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        min={minAmount}
                        max={10000}
                        step={0.01}
                      />
                    </div>

                    {selectedType === 'text' && (
                      <div>
                        <label className="block text-xs font-medium text-sage mb-1.5">
                          Mensagem <span className="text-sage-muted">({message.length}/200)</span>
                        </label>
                        <textarea
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface/40 text-offwhite text-sm placeholder:text-sage-muted focus:border-neon/50 focus:outline-none focus:ring-1 focus:ring-neon/20 transition-all resize-none"
                          placeholder="Sua mensagem para o streamer..."
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          maxLength={200}
                          rows={3}
                        />
                      </div>
                    )}

                    {(selectedType === 'audio' || selectedType === 'video') && (
                      <div>
                        <label className="block text-xs font-medium text-sage mb-1.5">
                          {selectedType === 'audio' ? 'Áudio' : 'Vídeo'}
                        </label>
                        <MediaRecorderComponent
                          mediaType={selectedType}
                          onBlobReady={handleBlobReady}
                          onClear={handleMediaClear}
                        />
                      </div>
                    )}

                    {error && (
                      <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleCreateDonation}
                      disabled={creatingDonation}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-neon to-cyan text-bg font-semibold text-sm shadow-neon hover:shadow-glow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {creatingDonation ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                          Preparando...
                        </span>
                      ) : (
                        'Gerar QR Code Pix'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {paymentStep === 'payment' && (
              <div className="space-y-6">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm text-sage hover:text-offwhite transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>

                <div className="glass p-6 space-y-6">
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-offwhite">Pagamento via Pix</h2>
                    <p className="text-sm text-sage mt-1">Escaneie o QR Code ou copie a chave</p>
                  </div>

                  {qrCode && (
                    <PixPayment
                      pixCopiaECola={pixCopiaECola}
                      amount={parseFloat(amount)}
                      onCopy={handleCopyPix}
                    />
                  )}

                  {copyFeedback && (
                    <div className="text-center text-sm text-neon font-medium animate-pulse">
                      Código Pix copiado!
                    </div>
                  )}

                  {timeLeft !== null && timeLeft > 0 && (
                    <div className="text-center">
                      <div className="text-xs text-sage">
                        Expira em {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                      </div>
                      <div className="w-full h-1 bg-surface rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-neon transition-all duration-1000"
                          style={{ width: `${(timeLeft / 1800) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-sage">De:</span>
                      <span className="text-offwhite font-medium">{donorName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sage">Tipo:</span>
                      <span className="text-offwhite font-medium">{DONATION_LABELS[selectedType!].title}</span>
                    </div>
                    {selectedType === 'text' && message && (
                      <div className="flex justify-between">
                        <span className="text-sage">Mensagem:</span>
                        <span className="text-offwhite font-medium truncate max-w-[200px]">{message}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neon/5 border border-neon/15">
                    <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
                    <span className="text-sm text-sage">Aguardando confirmação do pagamento...</span>
                  </div>

                  {isStreamerOwner && status === 'pending' && (
                    <div className="space-y-2">
                      <div className="px-3.5 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs text-center">
                        Modo desenvolvedor — confirmação manual disponível
                      </div>
                      <button
                        onClick={handleConfirmPayment}
                        disabled={confirmingPayment}
                        className="w-full py-2.5 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-medium border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {confirmingPayment ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                            Confirmando...
                          </span>
                        ) : (
                          'Confirmar pagamento manualmente'
                        )}
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
