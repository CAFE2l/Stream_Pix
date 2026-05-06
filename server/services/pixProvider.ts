export interface CreatePixChargeInput {
  txid: string
  amount: number
  payerName: string
  description?: string
}

export interface CreatePixChargeOutput {
  txid: string
  qrCode: string
  pixCopiaECola: string
  expiresIn: number
}

export interface WebhookVerificationResult {
  valid: boolean
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

function buildPixPayload(txid: string, amount: number, key: string): string {
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
    console.log('[MockPixProvider] Creating charge:', input)

    const pixCopiaECola = buildPixPayload(input.txid, input.amount, `DONATION_${input.txid}`)

    return {
      txid: input.txid,
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

class EfiPixProvider implements PixProvider {
  async createCharge(_input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    if (!process.env.EFI_CLIENT_ID || !process.env.EFI_CLIENT_SECRET || !process.env.EFI_CERT_PATH) {
      throw new Error('Efí Pix provider não configurado. Configure EFI_CLIENT_ID, EFI_CLIENT_SECRET e EFI_CERT_PATH.')
    }

    throw new Error('Efí Pix provider ainda não implementado. Configure as credenciais e implemente a lógica de cobrança.')
  }

  async verifyWebhook(
    _payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    if (!process.env.EFI_CLIENT_ID || !process.env.EFI_CLIENT_SECRET || !process.env.EFI_CERT_PATH) {
      throw new Error('Efí Pix provider não configurado.')
    }

    throw new Error('Efí webhook handler ainda não implementado.')
  }
}

class MercadoPagoPixProvider implements PixProvider {
  async createCharge(_input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error('Mercado Pago Pix provider não configurado. Configure MERCADO_PAGO_ACCESS_TOKEN.')
    }

    throw new Error('Mercado Pago Pix provider ainda não implementado. Configure o token e implemente a lógica de cobrança.')
  }

  async verifyWebhook(
    _payload: unknown,
    _headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error('Mercado Pago Pix provider não configurado.')
    }

    throw new Error('Mercado Pago webhook handler ainda não implementado.')
  }
}

function createProvider(): PixProvider {
  const provider = process.env.PIX_PROVIDER || 'mock'

  switch (provider) {
    case 'efi':
      console.log('[PixProvider] Using Efí provider')
      return new EfiPixProvider()
    case 'mercadopago':
      console.log('[PixProvider] Using Mercado Pago provider')
      return new MercadoPagoPixProvider()
    case 'mock':
    default:
      console.log('[PixProvider] Using Mock provider (development only)')
      return new MockPixProvider()
  }
}

export const pixProvider = createProvider()
