import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { uploadToCloudinary } from '../services/cloudinary'
import type { UserSettings, DonationType, PaymentStatus } from '../types'
import { MIN_AMOUNTS, DONATION_LABELS } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import DonationTypeCard from '../components/send/DonationTypeCard'
import MediaRecorderComponent from '../components/send/MediaRecorder'
import PixPayment from '../components/send/PixPayment'
import Input from '../components/ui/Input'

export default function SendDonation() {
  const { streamerId } = useParams<{ streamerId: string }>()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedType, setSelectedType] = useState<DonationType | null>(null)
  const [donorName, setDonorName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)

  const [showPayment, setShowPayment] = useState(false)
  const [donationId, setDonationId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [creatingDonation, setCreatingDonation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  // Listen for payment status changes on the donation document
  useEffect(() => {
    if (!streamerId || !donationId) return

    const docRef = doc(db, 'users', streamerId, 'donations', donationId)

    // For now, poll the document for status changes
    // In production, this would be replaced by a real-time webhook or listener
    const interval = setInterval(async () => {
      try {
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          if (data.paymentStatus === 'paid') {
            setPaymentStatus('paid')
            setSuccess(true)
            clearInterval(interval)
          } else if (data.paymentStatus === 'expired') {
            setPaymentStatus('expired')
            clearInterval(interval)
          } else if (data.paymentStatus === 'failed') {
            setPaymentStatus('failed')
            clearInterval(interval)
          }
        }
      } catch {
        // silently fail
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [streamerId, donationId])

  const handleBlobReady = useCallback((blob: Blob) => {
    setMediaBlob(blob)
  }, [])

  const handleMediaClear = useCallback(() => {
    setMediaBlob(null)
  }, [])

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
      let audioUrl: string | null = null
      let videoUrl: string | null = null

      if (selectedType === 'audio' && mediaBlob) {
        const file = new File([mediaBlob], `audio-${Date.now()}.webm`, {
          type: mediaBlob.type || 'audio/webm',
        })
        audioUrl = await uploadToCloudinary(file)
      }

      if (selectedType === 'video' && mediaBlob) {
        const file = new File([mediaBlob], `video-${Date.now()}.webm`, {
          type: mediaBlob.type || 'video/webm',
        })
        videoUrl = await uploadToCloudinary(file)
      }

      const donationsCol = collection(db, 'users', streamerId, 'donations')
      const docRef = await addDoc(donationsCol, {
        donorName: donorName.trim(),
        amount: parsedAmount,
        type: selectedType,
        message: selectedType === 'text' ? message.trim() : '',
        audioUrl,
        videoUrl,
        paymentStatus: 'pending',
        displayed: false,
        createdAt: serverTimestamp(),
      })

      setDonationId(docRef.id)
      setPaymentStatus('pending')
      setShowPayment(true)
    } catch (err) {
      console.error('Erro ao criar doação:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Erro ao criar doação: ${msg}`)
    } finally {
      setCreatingDonation(false)
    }
  }, [streamerId, selectedType, settings, donorName, amount, message, mediaBlob])

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
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center mx-auto mb-6">
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
            className="px-6 py-2.5 rounded-xl bg-neon/10 text-neon text-sm font-medium border border-neon/20 hover:bg-neon/20 transition-colors"
          >
            Enviar outra doação
          </button>
        </div>
      </div>
    )
  }

  const minAmount = selectedType ? MIN_AMOUNTS[selectedType] : 0

  return (
    <div className="min-h-screen bg-bg">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient opacity-50" />
      <div className="fixed inset-0 bg-grid-fine opacity-30" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
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

        {/* Content */}
        <main className="flex-1 px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            {!showPayment && (
              <>
                {/* Type selection */}
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
                          setMessage('')
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Form */}
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

            {/* Payment screen */}
            {showPayment && (
              <div className="space-y-6">
                <button
                  onClick={() => {
                    setShowPayment(false)
                    setDonationId(null)
                  }}
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

                  <PixPayment pixKey={settings.pixKey} amount={parseFloat(amount)} />

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

                  {/* Waiting status */}
                  <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neon/5 border border-neon/15">
                    <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
                    <span className="text-sm text-sage">Aguardando confirmação do pagamento...</span>
                  </div>

                  {paymentStatus === 'expired' && (
                    <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm text-center">
                      Pagamento expirado. Tente novamente.
                    </div>
                  )}

                  {paymentStatus === 'failed' && (
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
        </main>
      </div>
    </div>
  )
}
