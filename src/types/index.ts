import type { Timestamp } from 'firebase/firestore'

export type DonationType = 'text' | 'audio' | 'video'
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed'

export type UserSettings = {
  streamerName: string
  pixKey: string
  alertText: string
  primaryColor: string
  duration: number
  overlayEnabled: boolean
}

export type DonationEvent = {
  donorName: string
  amount: number
  type: DonationType
  message?: string
  audioUrl?: string
  videoUrl?: string
  paymentStatus: PaymentStatus
  createdAt?: Timestamp
  displayed?: boolean
  isTest?: boolean
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
