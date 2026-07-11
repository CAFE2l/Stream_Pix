import { useEffect, useState, useCallback, useRef } from 'react'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/layout/Navbar'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Toast from '../components/ui/Toast'
import type { UserSettings, DonationEvent, DonationType, PaymentStatus } from '../types'
import { DONATION_LABELS } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import QRCode from 'qrcode'

const rawApi = import.meta.env.VITE_API_URL || ''
const API_BASE = rawApi.startsWith('http') ? rawApi
  : rawApi ? `https://${rawApi}`
  : 'http://localhost:3001'

const TRANSACTIONS_PER_PAGE = 6
const PAGE_GROUP_SIZE = 3
const POLL_INTERVAL = 3000

export default function Dashboard() {
  const { user } = useAuth()
  const uid = user?.uid
  const [settings, setSettings] = useState<UserSettings>({
    streamerName: '',
    pixKey: '',
    alertText: 'Obrigado pela doação!',
    primaryColor: '#00FF88',
    duration: 5,
    overlayEnabled: true,
    theme: 'neon',
    soundEnabled: true,
    gifEnabled: true,
    overlayPosition: 'bottom-center',
    fontSize: 'md',
    cardSize: 'normal',
  })
  const [total, setTotal] = useState(0)
  const [alertsCount, setAlertsCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [pendingDonations, setPendingDonations] = useState<(DonationEvent & { id: string })[]>([])
  const [transactionHistory, setTransactionHistory] = useState<(DonationEvent & { id: string })[]>([])
  const [transactionPage, setTransactionPage] = useState(1)
  const [processingDonationId, setProcessingDonationId] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  )
  const seenPendingDonationIdsRef = useRef<Set<string>>(new Set())
  const hasLoadedDonationsRef = useRef(false)

  useEffect(() => {
    if (!uid) return
    seenPendingDonationIdsRef.current = new Set()
    hasLoadedDonationsRef.current = false

    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/${uid}`)
        if (res.ok) {
          const data = await res.json()
          setSettings({
            streamerName: data.streamerName || '',
            pixKey: data.pixKey || '',
            alertText: data.alertText || 'Obrigado pela doação!',
            primaryColor: data.primaryColor || '#00FF88',
            duration: data.duration || 5,
            overlayEnabled: data.overlayEnabled ?? true,
            theme: data.theme || 'neon',
            soundEnabled: data.soundEnabled ?? true,
            gifEnabled: data.gifEnabled ?? true,
            overlayPosition: data.overlayPosition || 'bottom-center',
            fontSize: data.fontSize || 'md',
            cardSize: data.cardSize || 'normal',
          })
        }
      } catch {
        // silently fail
      }
    }

    const loadDonations = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/donations/${uid}`)
        if (!res.ok) return

        const { donations } = await res.json()
        let t = 0
        let count = 0
        const pending: (DonationEvent & { id: string })[] = []
        const history: (DonationEvent & { id: string })[] = []

        for (const d of donations) {
          if (d.isTest !== true && d.status === 'paid') {
            t += d.amount || 0
            count++
          }
          if (d.status === 'pending') {
            pending.push(d)
          }
          if (d.status !== 'pending') {
            history.push(d)
          }
        }

        const sortNewestFirst = (a: DonationEvent, b: DonationEvent) => {
          const aTime = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0
          const bTime = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0
          return bTime - aTime
        }

        pending.sort(sortNewestFirst)
        history.sort(sortNewestFirst)

        const previousIds = seenPendingDonationIdsRef.current
        const newPending = pending.filter(donation => !previousIds.has(donation.id || ''))
        seenPendingDonationIdsRef.current = new Set(pending.map(donation => donation.id || ''))

        if (hasLoadedDonationsRef.current && newPending.length > 0) {
          newPending.forEach(showDonationNotification)
        }
        hasLoadedDonationsRef.current = true

        setTotal(t)
        setAlertsCount(count)
        setPendingDonations(pending)
        setTransactionHistory(history)
      } catch {
        setToast('Erro ao carregar doações pendentes')
      }
    }

    loadSettings()
    loadDonations()

    const interval = setInterval(loadDonations, POLL_INTERVAL)

    const generateQrCode = async () => {
      const sendUrl = `${window.location.origin}/send/${uid}`
      try {
        const url = await QRCode.toDataURL(sendUrl, {
          width: 200,
          margin: 1,
          color: { dark: '#0a1a12', light: '#F8FFFB' },
        })
        setQrCodeUrl(url)
      } catch {
        // silently fail
      }
    }

    generateQrCode()

    return () => clearInterval(interval)
  }, [uid])

  async function save() {
    if (!uid) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/settings/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setToast('Configurações salvas com sucesso!')
      } else {
        setToast('Erro ao salvar configurações')
      }
    } catch {
      setToast('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  function copyOverlayUrl() {
    if (!uid) return
    const url = `${window.location.origin}/overlay/${uid}`
    navigator.clipboard.writeText(url)
    setToast('URL do overlay copiada!')
  }

  function copySendUrl() {
    if (!uid) return
    const url = `${window.location.origin}/send/${uid}`
    navigator.clipboard.writeText(url)
    setToast('Link de doações copiado!')
  }

  function openPreview() {
    if (!uid) return
    window.open(`/overlay/${uid}`, '_blank', 'noopener,noreferrer')
  }

  function openQROverlay() {
    if (!uid) return
    window.open(`/overlay/qr/${uid}`, '_blank', 'noopener,noreferrer')
  }

  async function simulateDonation(amount: number, type: DonationType, label: string) {
    if (!uid) return
    try {
      await fetch(`${API_BASE}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId: uid,
          donorName: 'Teste Overlay',
          amount,
          type,
          message: 'Teste rápido do overlay',
          status: 'paid',
          isTest: true,
        }),
      })
      setToast(label)
    } catch {
      setToast('Erro ao enviar teste')
    }
  }

  async function confirmDonation(donationId: string) {
    if (!uid) return
    setProcessingDonationId(donationId)
    try {
      await fetch(`${API_BASE}/api/donations/${uid}/${donationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paidAt: new Date().toISOString(),
          displayed: false,
          isTest: false,
        }),
      })
      setToast('Doação confirmada para o overlay')
    } catch {
      setToast('Erro ao confirmar doação')
    } finally {
      setProcessingDonationId(null)
    }
  }

  async function rejectDonation(donationId: string) {
    if (!uid) return
    setProcessingDonationId(donationId)
    try {
      await fetch(`${API_BASE}/api/donations/${uid}/${donationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'failed',
          failureReason: 'Pagamento recusado manualmente',
        }),
      })
      setToast('Doação recusada')
    } catch {
      setToast('Erro ao recusar doação')
    } finally {
      setProcessingDonationId(null)
    }
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setToast('Este navegador não suporta notificações')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      setToast('Notificações de doação ativadas')
    } else if (permission === 'denied') {
      setToast('Notificações bloqueadas no navegador')
    } else {
      setToast('Permissão de notificação não ativada')
    }
  }

  function showDonationNotification(donation: DonationEvent & { id: string }) {
    const donorName = donation.donorName || 'Anônimo'
    const amount = formatCurrency(donation.amount || 0)
    const message = donation.message ? `Mensagem: ${donation.message}` : 'Aguardando confirmação manual'

    setToast(`Nova doação pendente: ${donorName} - ${amount}`)

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return
    }

    try {
      const notification = new Notification('Nova doação pendente', {
        body: `${donorName} enviou ${amount}. ${message}`,
        icon: '/images/icone.png',
        tag: `donation-${donation.id}`,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch {
      // Browser notification can fail depending on OS/browser settings.
    }
  }

  function getNotificationStatus() {
    if (typeof Notification === 'undefined') return 'Indisponível'
    if (notificationPermission === 'granted') return 'Ativas'
    if (notificationPermission === 'denied') return 'Bloqueadas'
    return 'Desativadas'
  }

  function getStatusLabel(status: PaymentStatus) {
    if (status === 'paid') return 'confirmada'
    if (status === 'played') return 'exibida'
    if (status === 'failed') return 'recusada'
    if (status === 'expired') return 'expirada'
    return 'pendente'
  }

  function getStatusClass(status: PaymentStatus) {
    if (status === 'paid' || status === 'played') return 'border-neon/25 bg-neon/10 text-neon'
    if (status === 'failed' || status === 'expired') return 'border-red-500/25 bg-red-500/10 text-red-300'
    return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
  }

  function getTransactionStatusClass(donation: DonationEvent) {
    if (donation.isTest) return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'
    return getStatusClass(donation.status)
  }

  function getTransactionStatusLabel(donation: DonationEvent) {
    if (donation.isTest) return 'Teste'
    return getStatusLabel(donation.status)
  }

  function formatDonationDate(donation: DonationEvent) {
    const createdAt = donation.createdAt
    if (!createdAt) return 'Agora'

    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return 'Agora'

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalTransactionPages = Math.max(1, Math.ceil(transactionHistory.length / TRANSACTIONS_PER_PAGE))
  const currentTransactionPage = Math.min(transactionPage, totalTransactionPages)
  const transactionStart = (currentTransactionPage - 1) * TRANSACTIONS_PER_PAGE
  const visibleTransactions = transactionHistory.slice(transactionStart, transactionStart + TRANSACTIONS_PER_PAGE)
  const currentPageGroup = Math.floor((currentTransactionPage - 1) / PAGE_GROUP_SIZE)
  const firstPageInGroup = currentPageGroup * PAGE_GROUP_SIZE + 1
  const visiblePageNumbers = Array.from(
    { length: Math.min(PAGE_GROUP_SIZE, totalTransactionPages - firstPageInGroup + 1) },
    (_, index) => firstPageInGroup + index
  )

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="min-h-screen bg-gradient bg-grid-fine">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-offwhite tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-sage/80">Gerencie seus alertas e configurações</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-sage font-medium">Total arrecadado</span>
              </div>
              <div className="text-xl font-bold text-gradient tracking-tight">
                {formatCurrency(total)}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <span className="text-xs text-sage font-medium">Alertas</span>
              </div>
              <div className="text-xl font-bold text-offwhite tracking-tight">{alertsCount}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs text-sage font-medium">Overlay</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${settings.overlayEnabled ? 'bg-neon shadow-neon' : 'bg-sage-muted/40'}`} />
                <span className="text-lg font-bold text-offwhite tracking-tight">
                  {settings.overlayEnabled ? 'Ativo' : 'Desativado'}
                </span>
              </div>
            </Card>
          </div>

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Settings — 2 cols */}
            <div className="lg:col-span-2">
              <Card className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v7.5m3.75-3.75h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-base font-bold text-offwhite tracking-tight">Doações pendentes</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border border-neon/20 bg-neon/5 text-xs font-semibold text-neon">
                    {pendingDonations.length}
                  </span>
                </div>

                {pendingDonations.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl bg-surface/30">
                    <div className="text-sm font-medium text-offwhite">Nenhuma doação aguardando confirmação</div>
                    <p className="text-xs text-sage/70 mt-1">Quando alguém pagar no Pix, confira no app da CAIXA e aprove aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingDonations.map(donation => (
                      <div
                        key={donation.id}
                        className="rounded-xl border border-border bg-surface/40 p-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-lg font-bold text-gradient">{formatCurrency(donation.amount || 0)}</span>
                              <span className="text-xs text-sage/70">{formatDonationDate(donation)}</span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-xs border border-amber-500/20">
                                pendente
                              </span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-sage">Doador: </span>
                                <span className="text-offwhite font-medium">{donation.donorName || 'Anônimo'}</span>
                              </div>
                              <div>
                                <span className="text-sage">Tipo: </span>
                                <span className="text-offwhite font-medium">{DONATION_LABELS[donation.type]?.title || donation.type}</span>
                              </div>
                            </div>

                            {donation.message && (
                              <div className="mt-2 text-sm text-offwhite/90 break-words">
                                {donation.message}
                              </div>
                            )}

                            <div className="mt-3 text-xs font-mono text-sage/80 break-all rounded-lg border border-border bg-bg/40 px-2.5 py-2">
                              Código: {donation.txid || donation.donationId || donation.id}
                            </div>
                          </div>

                          <div className="flex md:flex-col gap-2 md:w-32 shrink-0">
                            <button
                              onClick={() => confirmDonation(donation.id!)}
                              disabled={processingDonationId === donation.id}
                              className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-neon/10 text-neon text-sm font-semibold border border-neon/20 hover:bg-neon/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => rejectDonation(donation.id!)}
                              disabled={processingDonationId === donation.id}
                              className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-red-500/10 text-red-300 text-sm font-semibold border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-base font-bold text-offwhite tracking-tight">Histórico de transações</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border border-neon/20 bg-neon/5 text-xs font-semibold text-neon">
                    {transactionHistory.length}
                  </span>
                </div>

                {transactionHistory.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl bg-surface/30">
                    <div className="text-sm font-medium text-offwhite">Nenhuma transação no histórico</div>
                    <p className="text-xs text-sage/70 mt-1">Doações confirmadas, recusadas ou expiradas aparecem aqui.</p>
                  </div>
                ) : (
                  <>
                    <div key={currentTransactionPage} className="space-y-3 donate-step">
                      {visibleTransactions.map(donation => (
                        <div
                          key={donation.id}
                          className="group relative overflow-hidden rounded-xl border border-border bg-surface/35 p-4 shadow-[0_8px_22px_rgba(0,0,0,0.16)] transition-colors duration-200 sm:shadow-[0_16px_42px_rgba(0,0,0,0.18)] sm:transition-all sm:duration-300 sm:hover:-translate-y-0.5 sm:hover:border-neon/20 sm:hover:bg-surface/55 sm:hover:shadow-[0_18px_56px_rgba(0,255,136,0.08)]"
                        >
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-bold text-gradient">{formatCurrency(donation.amount || 0)}</span>
                                <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${getTransactionStatusClass(donation)}`}>
                                  {getTransactionStatusLabel(donation)}
                                </span>
                                <span className="text-xs text-sage/70">{formatDonationDate(donation)}</span>
                              </div>
                              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                                <div>
                                  <span className="text-sage">Doador: </span>
                                  <span className="font-medium text-offwhite">{donation.donorName || 'Anônimo'}</span>
                                </div>
                                <div>
                                  <span className="text-sage">Tipo: </span>
                                  <span className="font-medium text-offwhite">{DONATION_LABELS[donation.type]?.title || donation.type}</span>
                                </div>
                              </div>
                              {donation.message && (
                                <div className="mt-2 text-sm text-offwhite/85 break-words">{donation.message}</div>
                              )}
                            </div>
                            <div className="rounded-lg border border-offwhite/5 bg-bg/45 px-2.5 py-2 text-xs font-mono text-sage/75 break-all sm:max-w-[180px]">
                              {donation.txid || donation.donationId || donation.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-sage/70">
                        Página {currentTransactionPage} de {totalTransactionPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTransactionPage(Math.max(1, currentTransactionPage - 1))}
                          disabled={currentTransactionPage === 1}
                          aria-label="Página anterior"
                          className="w-9 h-9 rounded-xl border border-border bg-surface/40 text-sm font-bold text-sage hover:border-neon/20 hover:text-neon hover:bg-neon/5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {'<'}
                        </button>
                        {visiblePageNumbers.map(page => (
                          <button
                            key={page}
                            onClick={() => setTransactionPage(page)}
                            className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all duration-300 ${
                              page === currentTransactionPage
                                ? 'border-neon/40 bg-neon/15 text-neon shadow-neon'
                                : 'border-border bg-surface/40 text-sage hover:border-neon/20 hover:text-neon hover:bg-neon/5'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setTransactionPage(Math.min(totalTransactionPages, currentTransactionPage + 1))}
                          disabled={currentTransactionPage === totalTransactionPages}
                          aria-label="Próxima página"
                          className="w-9 h-9 rounded-xl border border-border bg-surface/40 text-sm font-bold text-sage hover:border-neon/20 hover:text-neon hover:bg-neon/5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {'>'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Configurações do alerta</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-sage mb-1.5">Nome do streamer</label>
                    <Input
                      value={settings.streamerName}
                      onChange={e => setSettings({ ...settings, streamerName: e.target.value })}
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-sage mb-1.5">Chave Pix</label>
                    <Input
                      value={settings.pixKey}
                      onChange={e => setSettings({ ...settings, pixKey: e.target.value })}
                      placeholder="Sua chave Pix"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-sage mb-1.5">Texto do alerta</label>
                    <Input
                      value={settings.alertText}
                      onChange={e => setSettings({ ...settings, alertText: e.target.value })}
                      placeholder="Obrigado pela doação!"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-sage mb-1.5">Cor principal</label>
                      <div className="flex gap-2">
                        <div
                          className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer shrink-0 overflow-hidden"
                          style={{ backgroundColor: settings.primaryColor }}
                        >
                          <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <Input
                          value={settings.primaryColor}
                          onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-sage mb-1.5">Duração (seg)</label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={String(settings.duration)}
                        onChange={e => setSettings({ ...settings, duration: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setSettings({ ...settings, overlayEnabled: !settings.overlayEnabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        settings.overlayEnabled ? 'bg-neon/30' : 'bg-sage-muted/20'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all duration-200 ${
                          settings.overlayEnabled ? 'translate-x-5 bg-neon' : 'bg-sage-muted'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-offwhite">Overlay habilitado</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    <Button onClick={save} disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar configurações'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right column — 1 col */}
            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Notificações</h3>
                </div>

                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-offwhite">{getNotificationStatus()}</div>
                    <div className="text-xs text-sage/70 mt-0.5">Alertas quando chegar doação pendente</div>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${notificationPermission === 'granted' ? 'bg-neon shadow-neon' : 'bg-sage-muted/40'}`} />
                </div>

                <button
                  onClick={enableNotifications}
                  disabled={typeof Notification === 'undefined' || notificationPermission === 'denied'}
                  className="w-full py-2.5 rounded-xl border border-neon/20 text-neon text-sm font-medium hover:bg-neon/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {notificationPermission === 'granted' ? 'Notificações ativadas' : 'Ativar notificações'}
                </button>
              </Card>

              {/* Preview */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Preview do alerta</h3>
                </div>

                <div
                  className="p-6 rounded-xl bg-black/40 border transition-all duration-300"
                  style={{ borderColor: settings.primaryColor + '40' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-bg font-black text-lg shrink-0"
                      style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, #00E5A8)` }}
                    >
                      R$
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-offwhite truncate">
                        Viewador doou {formatCurrency(25)}
                      </div>
                      <div className="text-sm text-sage/80 truncate mt-0.5">Mensagem do doador</div>
                      <div className="mt-1.5 text-sm font-semibold truncate" style={{ color: settings.primaryColor }}>
                        {settings.alertText}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Ações rápidas */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Ações rápidas</h3>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={copyOverlayUrl}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 hover:bg-surface-hover transition-all duration-200 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">Copiar URL do Overlay</div>
                      <div className="text-xs text-sage/70">Para usar como Browser Source no OBS</div>
                    </div>
                  </button>

                  <button
                    onClick={openPreview}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 hover:bg-surface-hover transition-all duration-200 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">Abrir Overlay</div>
                      <div className="text-xs text-sage/70">Visualizar em nova aba</div>
                    </div>
                  </button>

                  <button
                    onClick={openQROverlay}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 hover:bg-surface-hover transition-all duration-200 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75M13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">QR Code para OBS</div>
                      <div className="text-xs text-sage/70">Overlay com QR para doações na live</div>
                    </div>
                  </button>
                </div>
              </Card>

               {/* Testar overlay */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Testar overlay</h3>
                </div>

                <div className="space-y-2">
                  {([
                    { type: 'text' as DonationType, amount: 5, emoji: '🪙', label: 'Moeda', range: 'Até R$ 10', color: 'text-neon' },
                    { type: 'audio' as DonationType, amount: 25, emoji: '🎵', label: 'Áudio', range: 'R$ 10 – R$ 50', color: 'text-cyan' },
                    { type: 'video' as DonationType, amount: 50, emoji: '🎬', label: 'Vídeo', range: 'A partir de R$ 25', color: 'text-emerald-glow' },
                  ]).map(item => (
                    <button
                      key={item.type}
                      onClick={() => simulateDonation(item.amount, item.type, `Teste ${item.label} enviado!`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 hover:bg-surface-hover transition-all duration-200 text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center shrink-0">
                        <span className="text-lg">{item.emoji}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-offwhite">{item.label}</div>
                        <div className="text-xs text-sage">{item.range}</div>
                      </div>
                      <div className={`ml-auto text-sm font-bold ${item.color}`}>{formatCurrency(item.amount)}</div>
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs text-sage/70 text-center leading-relaxed">
                  Abra o overlay em outra aba para ver em tempo real
                </p>
              </Card>

              {/* QR Code da sua live */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                  <h3 className="text-base font-bold text-offwhite tracking-tight">QR Code da sua live</h3>
                </div>

                {qrCodeUrl && (
                  <div className="flex justify-center mb-4">
                    <img src={qrCodeUrl} alt="QR Code para doações" className="w-40 h-40 rounded-xl bg-white p-2" />
                  </div>
                )}

                <div className="text-center space-y-3">
                  <p className="text-xs text-sage/70">Compartilhe este QR Code para receber doações</p>
                  <button
                    onClick={copySendUrl}
                    className="w-full py-2.5 rounded-xl border border-neon/20 text-neon text-sm font-medium hover:bg-neon/10 transition-colors"
                  >
                    Copiar link de doações
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast} onClose={clearToast} />}
    </div>
  )
}
