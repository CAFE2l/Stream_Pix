import type { Timestamp } from 'firebase/firestore'

export type DonationType = 'text' | 'audio' | 'video'
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'played'
export type ThemePreset = 'neon' | 'minimal' | 'gamer' | 'cyberpunk' | 'clean'
export type OverlayPosition = 'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export type UserSettings = {
  streamerName: string
  pixKey: string
  alertText: string
  primaryColor: string
  duration: number
  overlayEnabled: boolean
  theme: ThemePreset
  soundEnabled: boolean
  gifEnabled: boolean
  overlayPosition: OverlayPosition
  fontSize: 'sm' | 'md' | 'lg'
  cardSize: 'compact' | 'normal' | 'large'
}

export interface ThemeConfig {
  name: string
  primaryColor: string
  bgColor: string
  borderColor: string
  fontFamily: string
  shadowColor: string
}

export const THEMES: Record<ThemePreset, ThemeConfig> = {
  neon: {
    name: 'Neon Pix',
    primaryColor: '#00FF88',
    bgColor: 'rgba(5, 8, 7, 0.85)',
    borderColor: 'rgba(0, 255, 136, 0.4)',
    fontFamily: 'system-ui',
    shadowColor: 'rgba(0, 255, 136, 0.3)',
  },
  minimal: {
    name: 'Minimalista',
    primaryColor: '#1a1a1a',
    bgColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    fontFamily: 'system-ui',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
  },
  gamer: {
    name: 'Gamer',
    primaryColor: '#ff4444',
    bgColor: 'rgba(20, 0, 0, 0.9)',
    borderColor: 'rgba(255, 68, 68, 0.4)',
    fontFamily: 'system-ui',
    shadowColor: 'rgba(255, 68, 68, 0.3)',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    primaryColor: '#ff00ff',
    bgColor: 'rgba(10, 0, 20, 0.9)',
    borderColor: 'rgba(255, 0, 255, 0.4)',
    fontFamily: 'system-ui',
    shadowColor: 'rgba(255, 0, 255, 0.3)',
  },
  clean: {
    name: 'Clean',
    primaryColor: '#3b82f6',
    bgColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    fontFamily: 'system-ui',
    shadowColor: 'rgba(59, 130, 246, 0.2)',
  },
}

export type DonationEvent = {
  id?: string
  donorName: string
  amount: number
  type: DonationType
  message?: string
  audioUrl?: string
  videoUrl?: string
  status: PaymentStatus
  createdAt?: Timestamp | string
  paidAt?: Timestamp | string
  playedAt?: Timestamp | string
  displayed?: boolean
  isTest?: boolean
  provider?: string
  providerPaymentId?: string
  providerStatus?: string
  txid?: string
  donationId?: string
  streamerId?: string
  endToEndId?: string
  cloudinaryPublicId?: string
  failureReason?: string
}

export const MIN_AMOUNTS: Record<DonationType, number> = {
  text: 1,
  audio: 10,
  video: 25,
}

export const DONATION_LABELS: Record<DonationType, { title: string; desc: string; min: string }> = {
  text: {
    title: 'Texto + GIF',
    desc: 'Envie uma mensagem que aparecerá na live com GIF animado',
    min: 'A partir de R$ 1,00',
  },
  audio: {
    title: 'Áudio',
    desc: 'Grave ou envie um áudio que será reproduzido na live',
    min: 'A partir de R$ 10,00',
  },
  video: {
    title: 'Vídeo',
    desc: 'Grave ou envie um vídeo que será exibido na live',
    min: 'A partir de R$ 25,00',
  },
}
