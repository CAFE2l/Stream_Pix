import { useEffect, useState, useCallback, useMemo } from 'react'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/layout/Navbar'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Toast from '../components/ui/Toast'
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, type DocumentSnapshot } from 'firebase/firestore'
import { db, serverTimestamp } from '../services/firebase'
import type { UserSettings, DonationEvent, DonationType, PaymentStatus, ThemePreset } from '../types'
import { THEMES as THEME_CONFIG } from '../types'
import { formatCurrency } from '../utils/formatCurrency'
import QRCode from 'qrcode'
import { devLog, devWarn } from '../utils/devLogger'

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
  const [todayTotal, setTodayTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [alertsCount, setAlertsCount] = useState(0)
  const [testCount, setTestCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [donations, setDonations] = useState<(DonationEvent & { id: string })[]>([])
  const [loadingDonations, setLoadingDonations] = useState(false)
  const [filterType, setFilterType] = useState<DonationType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all')
  const [topDonors, setTopDonors] = useState<{ name: string; total: number; count: number }[]>([])
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [showThemePicker, setShowThemePicker] = useState(false)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    if (!uid) return

    const loadSettings = async () => {
      const ref = doc(db, 'users', uid, 'settings', 'main')
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data() as UserSettings
        setSettings({
          streamerName: data.streamerName || '',
          pixKey: data.pixKey || '',
          alertText: data.alertText || 'Obrigado pela doação!',
          primaryColor: data.primaryColor || '#00FF88',
          duration: data.duration || 5,
          overlayEnabled: data.overlayEnabled !== undefined ? data.overlayEnabled : true,
          theme: data.theme || 'neon',
          soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true,
          gifEnabled: data.gifEnabled !== undefined ? data.gifEnabled : true,
          overlayPosition: data.overlayPosition || 'bottom-center',
          fontSize: data.fontSize || 'md',
          cardSize: data.cardSize || 'normal',
        })
      }
    }

    const loadStats = async () => {
      const donationsCol = collection(db, 'users', uid, 'donations')
      const snaps = await getDocs(donationsCol)

      let t = 0
      let today = 0
      let month = 0
      let count = 0
      let testC = 0
      const donorsMap = new Map<string, { total: number; count: number }>()

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      snaps.forEach((d: DocumentSnapshot) => {
        const data = d.data() as DonationEvent
        const isReal = data.isTest !== true

        if (isReal && (data.status === 'paid' || data.status === 'played')) {
          t += data.amount || 0
          count++

          const createdAt = data.createdAt ? new Date(data.createdAt as string) : null
          if (createdAt && createdAt >= todayStart) today += data.amount || 0
          if (createdAt && createdAt >= monthStart) month += data.amount || 0

          const name = data.donorName || 'Anônimo'
          const existing = donorsMap.get(name) || { total: 0, count: 0 }
          donorsMap.set(name, { total: existing.total + data.amount, count: existing.count + 1 })
        }

        if (!isReal) testC++
      })

      setTotal(t)
      setTodayTotal(today)
      setMonthTotal(month)
      setAlertsCount(count)
      setTestCount(testC)

      const sorted = Array.from(donorsMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
      setTopDonors(sorted)
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

    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          setBackendStatus('online')
        } else {
          setBackendStatus('offline')
        }
      } catch {
        setBackendStatus('offline')
      }
    }

    loadSettings()
    loadStats()
    generateQrCode()
    checkBackend()
  }, [uid, API_BASE])

  const loadDonations = useCallback(async () => {
    if (!uid) return
    setLoadingDonations(true)
    try {
      const donationsCol = collection(db, 'users', uid, 'donations')
      const q = query(donationsCol, orderBy('createdAt', 'desc'), limit(100))
      const snaps = await getDocs(q)
      const items = snaps.docs.map(d => ({ id: d.id, ...d.data() } as DonationEvent & { id: string }))
      setDonations(items)
      devLog('dashboard', `Loaded ${items.length} donations`)
    } catch (err) {
      devWarn('dashboard', 'Failed to load donations', err)
    } finally {
      setLoadingDonations(false)
    }
  }, [uid])

  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      if (filterType !== 'all' && d.type !== filterType) return false
      if (filterStatus !== 'all' && d.status !== filterStatus) return false
      return true
    })
  }, [donations, filterType, filterStatus])

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
      await setDoc(doc(col), {
        donorName: 'Teste Overlay',
        amount,
        type,
        message: 'Teste rápido do overlay',
        status: 'paid',
        isTest: true,
        createdAt: serverTimestamp(),
        displayed: false,
      })
      setToast(`${label} enviado!`)
    } catch {
      setToast('Erro ao enviar teste')
    }
  }

  async function replayDonation(donationId: string) {
    if (!uid) return
    try {
      const res = await fetch(`${API_BASE}/api/pix/donations/${uid}/${donationId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setToast('Doação reenviada para o overlay!')
      } else {
        setToast('Erro ao reenviar doação')
      }
    } catch {
      setToast('Erro ao reenviar doação')
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="min-h-screen bg-gradient bg-grid-fine">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-offwhite tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-sage/80">Gerencie seus alertas e configurações</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-sage font-medium">Hoje</span>
              </div>
              <div className="text-lg font-bold text-gradient tracking-tight">{formatCurrency(todayTotal)}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-xs text-sage font-medium">Mês</span>
              </div>
              <div className="text-lg font-bold text-offwhite tracking-tight">{formatCurrency(monthTotal)}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-emerald-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-sage font-medium">Total</span>
              </div>
              <div className="text-lg font-bold text-gradient tracking-tight">{formatCurrency(total)}</div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <span className="text-xs text-sage font-medium">Alertas</span>
              </div>
              <div className="text-lg font-bold text-offwhite tracking-tight">{alertsCount}</div>
            </Card>
          </div>

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Settings */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="text-base font-bold text-offwhite tracking-tight">Configurações</h3>
                  </div>
                  <button
                    onClick={() => setShowThemePicker(!showThemePicker)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-sage hover:text-offwhite hover:border-neon/30 transition-colors"
                  >
                    Temas
                  </button>
                </div>

                {showThemePicker && (
                  <div className="mb-4 p-3 rounded-xl bg-surface/40 border border-border">
                    <div className="text-xs font-medium text-sage mb-2">Tema</div>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(THEME_CONFIG).map(([key, theme]) => (
                        <button
                          key={key}
                          onClick={() => setSettings({ ...settings, theme: key as ThemePreset, primaryColor: theme.primaryColor })}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            settings.theme === key ? 'border-neon' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: theme.bgColor }}
                        >
                          <div className="w-full h-4 rounded mb-1" style={{ backgroundColor: theme.primaryColor }} />
                          <div className="text-[10px] text-sage truncate">{theme.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
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
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-sage mb-1.5">Texto do alerta</label>
                    <Input
                      value={settings.alertText}
                      onChange={e => setSettings({ ...settings, alertText: e.target.value })}
                      placeholder="Obrigado pela doação!"
                    />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
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

                    <div>
                      <label className="block text-xs font-medium text-sage mb-1.5">Fonte</label>
                      <select
                        value={settings.fontSize}
                        onChange={e => setSettings({ ...settings, fontSize: e.target.value as 'sm' | 'md' | 'lg' })}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface/40 text-offwhite text-sm focus:border-neon/50 focus:outline-none"
                      >
                        <option value="sm">Pequena</option>
                        <option value="md">Média</option>
                        <option value="lg">Grande</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.soundEnabled}
                        onChange={e => setSettings({ ...settings, soundEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border bg-surface/40 text-neon focus:ring-neon/20"
                      />
                      <span className="text-sm text-offwhite">Som</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.gifEnabled}
                        onChange={e => setSettings({ ...settings, gifEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border bg-surface/40 text-neon focus:ring-neon/20"
                      />
                      <span className="text-sm text-offwhite">GIF</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.overlayEnabled}
                        onChange={e => setSettings({ ...settings, overlayEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border bg-surface/40 text-neon focus:ring-neon/20"
                      />
                      <span className="text-sm text-offwhite">Overlay ativo</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    <Button onClick={save} disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar configurações'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Donation History */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-offwhite tracking-tight">Histórico de doações</h3>
                  <button
                    onClick={loadDonations}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-sage hover:text-offwhite transition-colors"
                  >
                    {loadingDonations ? 'Carregando...' : 'Atualizar'}
                  </button>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as DonationType | 'all')}
                    className="px-2 py-1 rounded-lg text-xs border border-border bg-surface/40 text-sage focus:outline-none"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="text">Texto</option>
                    <option value="audio">Áudio</option>
                    <option value="video">Vídeo</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as PaymentStatus | 'all')}
                    className="px-2 py-1 rounded-lg text-xs border border-border bg-surface/40 text-sage focus:outline-none"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="played">Exibido</option>
                    <option value="expired">Expirado</option>
                    <option value="failed">Falhou</option>
                  </select>
                </div>

                {filteredDonations.length === 0 ? (
                  <div className="text-center py-8 text-sage text-sm">Nenhuma doação encontrada</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredDonations.slice(0, 20).map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/20 hover:bg-surface/40 transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          d.status === 'paid' ? 'bg-neon' :
                          d.status === 'played' ? 'bg-cyan' :
                          d.status === 'pending' ? 'bg-amber-400 animate-pulse' :
                          'bg-red-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-offwhite truncate">{d.donorName || 'Anônimo'}</div>
                          <div className="text-xs text-sage">{d.type} {d.isTest && '(teste)'}</div>
                        </div>
                        <div className="text-sm font-bold text-neon">{formatCurrency(d.amount)}</div>
                        {d.status === 'paid' && !d.isTest && (
                          <button
                            onClick={() => replayDonation(d.id!)}
                            className="px-2 py-1 rounded text-xs border border-neon/20 text-neon hover:bg-neon/10 transition-colors"
                          >
                            Replay
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Quick actions */}
              <Card>
                <h3 className="text-base font-bold text-offwhite tracking-tight mb-4">Ações rápidas</h3>
                <div className="space-y-2">
                  <button onClick={copyOverlayUrl} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 transition-all text-left">
                    <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.9-3.653a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.34" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">Copiar URL do Overlay</div>
                      <div className="text-xs text-sage/70">Browser Source OBS</div>
                    </div>
                  </button>

                  <button onClick={openPreview} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 transition-all text-left">
                    <div className="w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">Abrir Overlay</div>
                      <div className="text-xs text-sage/70">Nova aba</div>
                    </div>
                  </button>

                  <button onClick={openQROverlay} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 transition-all text-left">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">QR Code OBS</div>
                      <div className="text-xs text-sage/70">Doações na live</div>
                    </div>
                  </button>

                  <button onClick={copySendUrl} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 transition-all text-left">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.19-3.146a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.34" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-offwhite">Copiar link de doações</div>
                      <div className="text-xs text-sage/70">Compartilhar com viewers</div>
                    </div>
                  </button>
                </div>
              </Card>

              {/* Status */}
              <Card>
                <h3 className="text-base font-bold text-offwhite tracking-tight mb-4">Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-sage">Overlay</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${settings.overlayEnabled ? 'bg-neon shadow-neon' : 'bg-sage-muted/40'}`} />
                      <span className="text-sm text-offwhite">{settings.overlayEnabled ? 'Ativo' : 'Desativado'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-sage">Backend</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        backendStatus === 'online' ? 'bg-neon' :
                        backendStatus === 'checking' ? 'bg-amber-400 animate-pulse' :
                        'bg-red-400'
                      }`} />
                      <span className="text-sm text-offwhite">
                        {backendStatus === 'online' ? 'Online' : backendStatus === 'checking' ? 'Verificando...' : 'Offline'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-sage">Testes</span>
                    <span className="text-sm text-offwhite">{testCount}</span>
                  </div>
                </div>
              </Card>

              {/* Top donors */}
              {topDonors.length > 0 && (
                <Card>
                  <h3 className="text-base font-bold text-offwhite tracking-tight mb-4">Top doadores</h3>
                  <div className="space-y-2">
                    {topDonors.map((donor, i) => (
                      <div key={donor.name} className="flex items-center gap-3 p-2 rounded-lg">
                        <span className="text-xs font-bold text-sage-muted w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-offwhite truncate">{donor.name}</div>
                          <div className="text-xs text-sage">{donor.count} doações</div>
                        </div>
                        <div className="text-sm font-bold text-neon">{formatCurrency(donor.total)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Test overlay */}
              <Card>
                <h3 className="text-base font-bold text-offwhite tracking-tight mb-4">Testar overlay</h3>
                <div className="space-y-2">
                  {([
                    { type: 'text' as DonationType, amount: 5, emoji: '🪙', label: 'Texto', range: 'Até R$ 10' },
                    { type: 'audio' as DonationType, amount: 25, emoji: '🎵', label: 'Áudio', range: 'R$ 10 – R$ 50' },
                    { type: 'video' as DonationType, amount: 50, emoji: '🎬', label: 'Vídeo', range: 'A partir de R$ 25' },
                  ]).map(item => (
                    <button
                      key={item.type}
                      onClick={() => simulateDonation(item.amount, item.type, `Teste ${item.label} enviado!`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:border-neon/20 transition-all text-left"
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-offwhite">{item.label}</div>
                        <div className="text-xs text-sage">{item.range}</div>
                      </div>
                      <div className="text-sm font-bold text-neon">{formatCurrency(item.amount)}</div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* QR Code */}
              <Card>
                <h3 className="text-base font-bold text-offwhite tracking-tight mb-4">QR Code</h3>
                {qrCodeUrl && (
                  <div className="flex justify-center mb-4">
                    <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 rounded-xl bg-white p-2" />
                  </div>
                )}
                <button onClick={copySendUrl} className="w-full py-2.5 rounded-xl border border-neon/20 text-neon text-sm font-medium hover:bg-neon/10 transition-colors">
                  Copiar link de doações
                </button>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast} onClose={clearToast} />}
    </div>
  )
}
