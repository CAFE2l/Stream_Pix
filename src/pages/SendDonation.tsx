import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { uploadToCloudinary } from '../services/cloudinary'
import type { UserSettings, DonationType, PaymentStatus } from '../types'
import { MIN_AMOUNTS, DONATION_LABELS } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import DonationTypeCard from '../components/send/DonationTypeCard'
import MediaRecorderComponent from '../components/send/MediaRecorder'
import PixPayment from '../components/send/PixPayment'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const ENABLE_MANUAL_CONFIRM = import.meta.env.VITE_ENABLE_MANUAL_CONFIRM === 'true'

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

  const [showPayment, setShowPayment] = useState(false)
  const [donationId, setDonationId] = useState<string | null>(null)
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [creatingDonation, setCreatingDonation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [qrCode, setQrCode] = useState('')
  const [pixCopiaECola, setPixCopiaECola] = useState('')
  const [confirmingPayment, setConfirmingPayment] = useState(false)

  const unsubRef = useRef<(() => void) | null>(null)

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
      } catch {
        // silently fail
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

        if (data.status === 'paid') {
          setSuccess(true)
        }
      }
    }, (err) => {
      console.error('Erro ao ouvir doação:', err)
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [streamerId, donationId])

  const handleBlobReady = useCallback((blob: Blob) => {
    setMediaBlob(blob)
  }, [])

  const handleMediaClear = useCallback(() => {
    setMediaBlob(null)
  }, [])

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

      // Firestore listener will update status automatically
    } catch (err) {
      console.error('Erro ao confirmar pagamento:', err)
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
    if (isNaN(parsedAmount) || parsedAmount < minAmount) {
      setError(`Valor mínimo para ${DONATION_LABELS[selectedType].title} é ${formatCurrency(minAmount)}`)
      return
    }
    if (selectedType === 'text' && !message.trim()) {
      setError('Digite uma mensagem')
      return
    }
    if (selectedType !== 'text' && !mediaBlob) {
      setError(selectedType === 'audio' ? 'Grave ou envie um áudio' : 'Grave ou envie um vídeo')
      return
    }

    setCreatingDonation(true)

    try {
      let mediaUrl: string | null = null

      if (selectedType === 'audio' && mediaBlob) {
        const file = new File([mediaBlob], `audio-${Date.now()}.webm`, {
          type: mediaBlob.type || 'audio/webm',
        })
        mediaUrl = await uploadToCloudinary(file)
      }

      if (selectedType === 'video' && mediaBlob) {
        const file = new File([mediaBlob], `video-${Date.now()}.webm`, {
          type: mediaBlob.type || 'video/webm',
        })
        mediaUrl = await uploadToCloudinary(file)
      }

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
      setShowPayment(true)
    } catch (err) {
      console.error('Erro ao criar doação:', err)
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
  }, [streamerId, selectedType, settings, donorName, amount, message, mediaBlob])

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
      }
    }
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

  if (success) {
    return (
      <div className="min-h-screen donate-shell flex items-center justify-center px-4 py-10">
        <div className="donate-card w-full max-w-sm rounded-[28px] p-8 text-center">
          <div className="donate-profile-ring w-20 h-20 rounded-full border border-neon/35 bg-black/50 p-1.5 mx-auto mb-5">
            <img src="/images/pfp.png" alt={settings.streamerName || 'Streamer'} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center mx-auto mb-6 shadow-neon">
            <svg className="w-8 h-8 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-offwhite mb-2">Pagamento confirmado!</h2>
          <p className="text-sm text-sage mb-6">
            Sua mensagem aparecerá na live de <span className="text-neon font-semibold">{settings.streamerName}</span> em instantes.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-neon/10 text-neon text-sm font-medium border border-neon/20 hover:bg-neon/20 hover:shadow-neon transition-all duration-300"
          >
            Enviar outra doação
          </button>
        </div>
      </div>
    )
  }

  const minAmount = selectedType ? MIN_AMOUNTS[selectedType] : 0
  const streamerName = settings.streamerName || 'Stream Pix'

  return (
    <div className="min-h-screen donate-shell overflow-hidden">
      <div className="fixed inset-0 bg-grid-fine opacity-45" />
      <div className="fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/70 to-transparent shadow-[0_0_24px_rgba(0,255,136,0.75)]" />
      <div className="fixed inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-offwhite/25 to-transparent" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <main className="flex-1 px-4 py-8 md:py-12">
          <div className="max-w-xl mx-auto">
            <section className="donate-card rounded-[30px] p-5 sm:p-7">
              <div className="relative text-center pb-6 mb-6 border-b border-offwhite/10">
                <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent shadow-[0_0_18px_rgba(0,255,136,0.7)]" />
                <div className="donate-profile-ring w-24 h-24 rounded-full border border-neon/35 bg-black/55 p-1.5 mx-auto mb-4">
                  <img src="/images/pfp.png" alt={streamerName} className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neon mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
                  Donate Pix
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-offwhite tracking-tight">{streamerName}</h1>
                <p className="mt-2 text-sm text-sage">Envie uma doação para aparecer na live</p>
              </div>

              <div className="space-y-6">
            {!showPayment && (
              <div className="donate-step">
                <div>
                  <h2 className="text-sm font-semibold text-offwhite mb-3 uppercase tracking-wider">Escolha o tipo</h2>
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
                          setMessage('')
                        }}
                      />
                    ))}
                  </div>
                </div>

                {selectedType && (
                  <div className="space-y-4 mt-6">
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
                        step={0.01}
                      />
                    </div>

                    {selectedType === 'text' && (
                      <div>
                        <label className="block text-xs font-medium text-sage mb-1.5">Mensagem</label>
                        <Input
                          placeholder="Sua mensagem para o streamer..."
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          maxLength={200}
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
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neon via-emerald-glow to-neon bg-[length:200%_100%] text-bg font-black text-sm shadow-neon hover:shadow-glow-lg hover:bg-right transition-all duration-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
              </div>
            )}

            {showPayment && (
              <div className="donate-step space-y-6">
                <button
                  onClick={() => {
                    setShowPayment(false)
                    setDonationId(null)
                    setQrCode('')
                    setPixCopiaECola('')
                  }}
                  className="flex items-center gap-2 text-sm text-sage hover:text-offwhite transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>

                <div className="rounded-3xl border border-neon/15 bg-black/25 p-5 sm:p-6 space-y-6 shadow-[0_0_38px_rgba(0,255,136,0.08)]">
                  <div className="text-center">
                    <h2 className="text-xl font-black text-offwhite">Pagamento via Pix</h2>
                    <p className="text-sm text-sage mt-1">Escaneie o QR Code ou copie o código</p>
                  </div>

                  {qrCode && (
                    <PixPayment
                      pixCopiaECola={pixCopiaECola}
                      amount={parseFloat(amount)}
                    />
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4 rounded-xl border border-offwhite/5 bg-white/[0.03] px-3 py-2">
                      <span className="text-sage">De:</span>
                      <span className="text-offwhite font-medium">{donorName}</span>
                    </div>
                    <div className="flex justify-between gap-4 rounded-xl border border-offwhite/5 bg-white/[0.03] px-3 py-2">
                      <span className="text-sage">Tipo:</span>
                      <span className="text-offwhite font-medium">{DONATION_LABELS[selectedType!].title}</span>
                    </div>
                    {selectedType === 'text' && message && (
                      <div className="flex justify-between gap-4 rounded-xl border border-offwhite/5 bg-white/[0.03] px-3 py-2">
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

                  {status === 'expired' && (
                    <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
                      Pagamento expirado. Tente novamente.
                    </div>
                  )}

                  {status === 'failed' && (
                    <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
                      Pagamento não confirmado. Tente novamente.
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
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
