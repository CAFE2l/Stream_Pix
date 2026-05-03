import { useEffect, useState, useCallback } from 'react'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/layout/Navbar'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Toast from '../components/ui/Toast'
import { doc, setDoc, getDoc, collection, addDoc, getDocs, type DocumentSnapshot } from 'firebase/firestore'
import { db, serverTimestamp } from '../services/firebase'
import type { UserSettings, DonationEvent, DonationType } from '../types'
import { MIN_AMOUNTS, DONATION_LABELS } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import QRCode from 'qrcode'

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
  })
  const [total, setTotal] = useState(0)
  const [alertsCount, setAlertsCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    if (!uid) return

    const loadSettings = async () => {
      const ref = doc(db, 'users', uid, 'settings', 'main')
      const snap = await getDoc(ref)
      if (snap.exists()) setSettings(snap.data() as UserSettings)
    }

    const loadStats = async () => {
      const donationsCol = collection(db, 'users', uid, 'donations')
      const snaps = await getDocs(donationsCol)
      let t = 0
      snaps.forEach((d: DocumentSnapshot) => {
        const data = d.data() as DonationEvent
        t += data.amount || 0
      })
      setTotal(t)
      setAlertsCount(snaps.size)
    }

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

    loadSettings()
    loadStats()
    generateQrCode()
  }, [uid])

  async function save() {
    if (!uid) return
    setSaving(true)
    try {
      const ref = doc(db, 'users', uid, 'settings', 'main')
      await setDoc(ref, settings, { merge: true })
      setToast('Configurações salvas com sucesso!')
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
      const col = collection(db, 'users', uid, 'donations')
      await addDoc(col, {
        donorName: 'Teste Overlay',
        amount,
        type,
        message: 'Teste rápido do overlay',
        paymentStatus: 'paid',
        createdAt: serverTimestamp(),
        displayed: false,
      })
      setToast(label)
    } catch {
      setToast('Erro ao enviar teste')
    }
  }

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
              <Card>
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
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
