const PROFANITY_WORDS = [
  'buceta', 'caralho', 'cacete', 'porra', 'puta', 'puto', 'foder', 'foda',
  'merda', 'cu', 'cuzao', 'viado', 'viadagem', 'bicha', 'pinto', 'rola',
  'xana', 'xoxota', 'pica', 'picaia', 'aranha', 'krl', 'krll', 'prr',
  'ctz', 'mds', 'vtmnc', 'filho da puta', 'fdp', 'cabrao', 'cabrão',
]

const SUSPICIOUS_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /www\.[^\s]+/i,
  /t\.me\//i,
  /wa\.me\//i,
  /discord\.gg\//i,
  /bit\.ly\//i,
  /tinyurl\.com\//i,
]

export interface TextValidationResult {
  valid: boolean
  error?: string
}

export function validateText(
  text: string,
  maxLength: number = 200,
  minLength: number = 1
): TextValidationResult {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Texto é obrigatório' }
  }

  if (text.length < minLength) {
    return { valid: false, error: `Texto muito curto (mínimo ${minLength} caracteres)` }
  }

  if (text.length > maxLength) {
    return { valid: false, error: `Texto muito longo (máximo ${maxLength} caracteres)` }
  }

  if (containsProfanity(text)) {
    return { valid: false, error: 'Texto contém palavras inadequadas' }
  }

  if (containsSuspiciousLinks(text)) {
    return { valid: false, error: 'Links não são permitidos' }
  }

  if (isSpam(text)) {
    return { valid: false, error: 'Texto parece spam' }
  }

  return { valid: true }
}

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return PROFANITY_WORDS.some(word => {
    const normalized = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return lower.includes(normalized)
  })
}

export function containsSuspiciousLinks(text: string): boolean {
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(text))
}

export function isSpam(text: string): boolean {
  if (text.length < 5) return false

  const uniqueChars = new Set(text.toLowerCase()).size
  const charRatio = uniqueChars / text.length

  if (charRatio < 0.15) return true

  const words = text.split(/\s+/)
  if (words.length > 3) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size
    const wordRatio = uniqueWords / words.length
    if (wordRatio < 0.2) return true
  }

  const repeatedChars = /(.)\1{5,}/.test(text)
  if (repeatedChars) return true

  const allCaps = text === text.toUpperCase() && text.length > 10 && /[A-Z]/.test(text)
  if (allCaps) return true

  return false
}

export interface MediaValidationResult {
  valid: boolean
  error?: string
}

export const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_AUDIO_DURATION = 60 // 60 seconds
export const MAX_VIDEO_DURATION = 120 // 120 seconds
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac']
export const ALLOWED_VIDEO_TYPES = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']

export function validateAudioFile(file: File): MediaValidationResult {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato de áudio não aceito. Use MP3, WAV, OGG ou WebM' }
  }

  if (file.size > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Áudio muito grande. Máximo: ${MAX_AUDIO_SIZE / 1024 / 1024}MB` }
  }

  return { valid: true }
}

export function validateVideoFile(file: File): MediaValidationResult {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato de vídeo não aceito. Use MP4, WebM ou MOV' }
  }

  if (file.size > MAX_VIDEO_SIZE) {
    return { valid: false, error: `Vídeo muito grande. Máximo: ${MAX_VIDEO_SIZE / 1024 / 1024}MB` }
  }

  return { valid: true }
}

export function validateMediaDuration(file: File, maxDuration: number): Promise<MediaValidationResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio')

    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = Math.round(el.duration)
      if (duration > maxDuration) {
        resolve({
          valid: false,
          error: `${file.type.startsWith('video') ? 'Vídeo' : 'Áudio'} muito longo. Máximo: ${maxDuration}s`,
        })
      } else {
        resolve({ valid: true })
      }
    }

    el.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, error: 'Não foi possível verificar a duração da mídia' })
    }

    el.src = url
  })
}

export const RATE_LIMIT_WINDOW = 60000 // 1 minute
export const MAX_REQUESTS_PER_WINDOW = 5

const rateLimitMap = new Map<string, number[]>()

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const requests = rateLimitMap.get(identifier) || []

  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW)

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = recentRequests[0]
    const retryAfter = Math.ceil((oldestInWindow + RATE_LIMIT_WINDOW - now) / 1000)
    return { allowed: false, retryAfter }
  }

  recentRequests.push(now)
  rateLimitMap.set(identifier, recentRequests)

  return { allowed: true }
}
