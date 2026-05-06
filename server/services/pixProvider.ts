export interface CreatePixChargeInput {
  txid: string
  amount: number
  payerName: string
  payerEmail?: string
  description?: string
}

export interface CreatePixChargeOutput {
  txid: string
  paymentId: string
  qrCode: string
  pixCopiaECola: string
  expiresIn: number
}

export interface WebhookVerificationResult {
  valid: boolean
  paymentId?: string
  txid?: string
  status?: string
  amount?: number
  endToEndId?: string
}

export interface PixProvider {
  createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput>
  verifyWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookVerificationResult>
}

function calculateCRC16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  crc = crc & 0xffff
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function buildStaticPixPayload(txid: string, amount: number, key: string): string {
  const amountStr = amount.toFixed(2)
  const merchantName = 'STREAMPIX'
  const merchantCity = 'SAO PAULO'

  function tlv(id: string, val: string): string {
    return id + val.length.toString().padStart(2, '0') + val
  }

  const gui = tlv('00', 'BR.GOV.BCB.PIX')
  const pixKeyValue = tlv('01', key)
  const txidField = tlv('05', txid)
  const field26 = tlv('26', gui + pixKeyValue)
  const field62 = tlv('62', txidField)

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
  payload += field62
  payload += '6304'

  return payload + calculateCRC16(payload)
}

class MockPixProvider implements PixProvider {
  async createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    const pixCopiaECola = buildStaticPixPayload(input.txid, input.amount, `DONATION_${input.txid}`)

    return {
      txid: input.txid,
      paymentId: `mock_${input.txid}`,
      qrCode: pixCopiaECola,
      pixCopiaECola,
      expiresIn: 1800,
    }
  }

  async verifyWebhook(
    _payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    return { valid: false }
  }
}

class OpenPixProvider implements PixProvider {
  private appID: string
  private baseUrl = 'https://api.openpix.com.br/api/v1'

  constructor() {
    this.appID = process.env.OPENPIX_APP_ID || ''
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.appID,
    }
  }

  async createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    if (!this.appID) {
      throw new Error('OpenPix não configurado. Adicione OPENPIX_APP_ID no .env')
    }

    const chargeData = {
      value: Math.round(input.amount * 100),
      correlationID: input.txid,
      comment: input.description || `Doação Stream Pix - ${input.payerName}`,
    }

    const response = await fetch(`${this.baseUrl}/charge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(chargeData),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('[OpenPix] Failed to create charge:', error)
      throw new Error(error.message || `OpenPix API error: ${response.status}`)
    }

    const data = await response.json()

    const charge = data.charge || data

    const pixCopiaECola = charge.brCode || ''
    const qrCode = charge.qrCodeImage || charge.brCode || ''
    const paymentId = charge.identifier || charge.globalID || charge.correlationID

    if (!paymentId || !pixCopiaECola) {
      throw new Error('OpenPix não retornou dados do Pix')
    }

    return {
      txid: input.txid,
      paymentId,
      qrCode,
      pixCopiaECola,
      expiresIn: charge.expiresIn || 1800,
    }
  }

  async verifyPayment(correlationID: string): Promise<{
    status: string
    amount: number
    value?: number
  } | null> {
    if (!this.appID) {
      throw new Error('OpenPix não configurado')
    }

    const response = await fetch(`${this.baseUrl}/charge?correlationID=${correlationID}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      console.error(`[OpenPix] Failed to fetch charge ${correlationID}:`, response.status)
      return null
    }

    const data = await response.json()
    const charge = data.charge || (Array.isArray(data.charges) ? data.charges[0] : null)

    if (!charge) return null

    return {
      status: charge.status,
      amount: (charge.value || 0) / 100,
      value: charge.value,
    }
  }

  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    const data = payload as Record<string, unknown>

    const event = data.event as string | undefined
    const chargeData = data.charge as Record<string, unknown> | undefined

    if (event === 'pix:payment' && chargeData) {
      const status = chargeData.status as string
      const correlationID = chargeData.correlationID as string
      const value = Number(chargeData.value || 0) / 100

      if (status === 'COMPLETED' || status === 'PAID') {
        return {
          valid: true,
          paymentId: chargeData.identifier as string,
          txid: correlationID,
          status: 'approved',
          amount: value,
        }
      }

      if (status === 'EXPIRED') {
        return {
          valid: true,
          paymentId: chargeData.identifier as string,
          txid: correlationID,
          status: 'expired',
          amount: value,
        }
      }
    }

    return { valid: false }
  }
}

function createProvider(): PixProvider {
  const provider = process.env.PIX_PROVIDER || 'mock'

  if (provider === 'openpix') {
    if (!process.env.OPENPIX_APP_ID) {
      console.error('[PixProvider] OpenPix selected but OPENPIX_APP_ID not set')
      throw new Error('PIX_PROVIDER=openpix requires OPENPIX_APP_ID')
    }
    console.log('[PixProvider] Using OpenPix provider')
    return new OpenPixProvider()
  }

  if (provider === 'mercadopago') {
    console.warn('[PixProvider] Mercado Pago provider removed. Use PIX_PROVIDER=openpix instead')
    throw new Error('Mercado Pago provider is no longer available. Use OpenPix (PIX_PROVIDER=openpix)')
  }

  if (provider === 'mock') {
    console.log('[PixProvider] Using Mock provider (development only)')
    return new MockPixProvider()
  }

  throw new Error(`Unknown PIX_PROVIDER: ${provider}`)
}

export const pixProvider = createProvider()
