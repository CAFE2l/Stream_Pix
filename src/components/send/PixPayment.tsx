import QRCode from 'qrcode'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '../../utils/formatCurrency'

type PixPaymentProps = {
  pixKey: string
  amount: number
  onCopy?: () => void
}

export function generateStaticPix(key: string, value: number): string {
  const amountStr = value.toFixed(2)
  const merchantName = 'PIX'
  const merchantCity = 'SAO PAULO'

  function tlv(id: string, val: string): string {
    return id + val.length.toString().padStart(2, '0') + val
  }

  // Build Merchant Account Info (field 26) with nested subfields
  const gui = tlv('00', 'BR.GOV.BCB.PIX')
  const pixKeyValue = tlv('01', key)
  const field26 = tlv('26', gui + pixKeyValue)

  let payload = ''
  payload += tlv('00', '01')
  payload += tlv('01', '12')
  payload += field26
  payload += tlv('52', '0000')
  payload += tlv('53', '986')
  payload += tlv('54', amountStr)
  payload += tlv('58', 'BR')
  payload += tlv('59', merchantName)
  payload += tlv('60', merchantCity)
  payload += tlv('62', tlv('05', '***'))
  payload += '6304'

  const crc = calculateCRC16(payload)
  payload += crc

  return payload
}

export function calculateCRC16(payload: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  crc = crc & 0xFFFF
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export default function PixPayment({ pixKey, amount, onCopy }: PixPaymentProps) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const pixPayload = generateStaticPix(pixKey, amount)

  useEffect(() => {
    if (!pixKey || !amount) return

    QRCode.toDataURL(pixPayload, {
      width: 220,
      margin: 2,
      color: { dark: '#0a1a12', light: '#F8FFFB' },
    })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''))
  }, [pixKey, amount])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(pixPayload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.()
    })
  }, [pixPayload, onCopy])

  return (
    <div className="flex flex-col items-center gap-4">
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QR Code Pix" className="w-56 h-56 rounded-xl bg-white p-2" />
      ) : (
        <div className="w-56 h-56 rounded-xl bg-white flex items-center justify-center text-sage text-sm">
          Gerando QR Code...
        </div>
      )}
      <div className="text-center w-full">
        <div className="text-2xl font-bold text-neon">{formatCurrency(amount)}</div>
        <div className="text-xs text-sage mt-1 font-mono break-all px-2 py-1.5 rounded-lg bg-surface/60 border border-border mt-3 max-h-16 overflow-y-auto">{pixPayload}</div>
      </div>
      <button
        onClick={handleCopy}
        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          copied
            ? 'bg-neon/20 text-neon border border-neon/30'
            : 'bg-neon/10 text-neon border border-neon/20 hover:bg-neon/20'
        }`}
      >
        {copied ? '✓ Copiado!' : 'Copiar código Pix'}
      </button>
    </div>
  )
}
