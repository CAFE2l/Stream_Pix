export interface CreatePixChargeInput {
  txid: string
  amount: number
  pixKey?: string
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
    if (!input.pixKey?.trim()) {
      throw new Error('Chave Pix do streamer não configurada')
    }

    const pixCopiaECola = buildStaticPixPayload(input.txid, input.amount, input.pixKey.trim())

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

class MercadoPagoPixProvider implements PixProvider {
  private accessToken: string
  private baseUrl = 'https://api.mercadopago.com'

  constructor() {
    this.accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-Idempotency-Key': `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
  }

  async createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    if (!this.accessToken) {
      throw new Error('Mercado Pago não configurado. Adicione MERCADO_PAGO_ACCESS_TOKEN no .env')
    }

    const paymentData = {
      transaction_amount: input.amount,
      description: input.description || `Doação Stream Pix`,
      payment_method_id: 'pix',
      payer: {
        email: input.payerEmail || 'donor@streampix.com',
        first_name: input.payerName || 'Doador',
      },
      external_reference: input.txid,
      notification_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/api/pix/webhook`,
    }

    const response = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('[MercadoPago] Failed to create payment:', error)
      throw new Error(error.message || `Mercado Pago API error: ${response.status}`)
    }

    const data = await response.json()

    const qrCode = data.point_of_interaction?.transaction_data?.qr_code || ''
    const pixCopiaECola = data.point_of_interaction?.transaction_data?.qr_code || ''
    const paymentId = String(data.id)

    if (!paymentId || !qrCode) {
      throw new Error('Mercado Pago não retornou dados do Pix')
    }

    return {
      txid: input.txid,
      paymentId,
      qrCode,
      pixCopiaECola,
      expiresIn: 1800,
    }
  }

  async verifyPayment(paymentId: string): Promise<{
    status: string
    amount: number
    externalReference: string
    endToEndId?: string
  } | null> {
    if (!this.accessToken) {
      throw new Error('Mercado Pago não configurado')
    }

    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      console.error(`[MercadoPago] Failed to fetch payment ${paymentId}:`, response.status)
      return null
    }

    const data = await response.json()

    return {
      status: data.status,
      amount: data.transaction_amount,
      externalReference: data.external_reference,
      endToEndId: data.point_of_interaction?.transaction_data?.end_to_end_id,
    }
  }

  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    const data = payload as Record<string, unknown>

    if (data.type === 'payment' && data.data?.id) {
      const paymentId = String(data.data.id)
      const payment = await this.verifyPayment(paymentId)

      if (!payment) {
        return { valid: false }
      }

      return {
        valid: true,
        paymentId,
        txid: payment.externalReference,
        status: payment.status,
        amount: payment.amount,
        endToEndId: payment.endToEndId,
      }
    }

    return { valid: false }
  }
}

function createProvider(): PixProvider {
  const provider = process.env.PIX_PROVIDER || 'mock'

  if (provider === 'mercadopago') {
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      console.error('[PixProvider] Mercado Pago selected but MERCADO_PAGO_ACCESS_TOKEN not set')
      throw new Error('PIX_PROVIDER=mercadopago requires MERCADO_PAGO_ACCESS_TOKEN')
    }
    console.log('[PixProvider] Using Mercado Pago provider')
    return new MercadoPagoPixProvider()
  }

  if (provider === 'mock') {
    console.log('[PixProvider] Using Mock provider (development only)')
    return new MockPixProvider()
  }

  throw new Error(`Unknown PIX_PROVIDER: ${provider}`)
}

export const pixProvider = createProvider()
