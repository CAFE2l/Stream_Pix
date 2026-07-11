import { Router, Request, Response } from 'express'
import { query } from '../services/db.js'
import { pixProvider } from '../services/pixProvider.js'
import crypto from 'crypto'

const router = Router()

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PixAPI]', ...args)
  }
}

router.post('/create-charge', async (req: Request, res: Response) => {
  try {
    const { streamerId, amount, type, name, message, mediaUrl, cloudinaryPublicId } = req.body

    if (!streamerId || !amount || !type) {
      return res.status(400).json({ error: 'streamerId, amount e type são obrigatórios' })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount deve ser um número positivo' })
    }

    const minAmounts: Record<string, number> = { text: 1, audio: 10, video: 25 }
    const minAmount = minAmounts[type]
    if (!minAmount) {
      return res.status(400).json({ error: 'Tipo de doação inválido. Use: text, audio ou video' })
    }
    if (amount < minAmount) {
      return res.status(400).json({ error: `Valor mínimo para ${type} é R$ ${minAmount.toFixed(2)}` })
    }
    if (amount > 10000) {
      return res.status(400).json({ error: 'Valor máximo permitido é R$ 10.000,00' })
    }

    if (message && typeof message === 'string' && message.length > 200) {
      return res.status(400).json({ error: 'Mensagem muito longa (máximo 200 caracteres)' })
    }

    const settingsResult = await query<{ pix_key: string }>(
      'SELECT pix_key FROM public.streamer_settings WHERE user_id = $1',
      [streamerId]
    )
    const streamerPixKey = settingsResult.rows.length > 0 ? String(settingsResult.rows[0].pix_key || '').trim() : ''

    if (!streamerPixKey) {
      return res.status(400).json({ error: 'Streamer sem chave Pix configurada.' })
    }

    const donationId = crypto.randomUUID()
    const txid = `sp${streamerId.slice(0, 6)}${donationId.slice(0, 8)}`
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()

    const donorName = name?.trim() || 'Anônimo'

    await query(
      `INSERT INTO public.donations (
        streamer_id, donor_name, amount, donation_type, message,
        audio_url, video_url, cloudinary_public_id, status, is_test,
        provider, txid, donation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', false, $9, $10, $11)`,
      [
        streamerId,
        donorName,
        amount,
        type,
        message?.trim() || '',
        type === 'audio' ? (mediaUrl || null) : null,
        type === 'video' ? (mediaUrl || null) : null,
        cloudinaryPublicId || null,
        process.env.PIX_PROVIDER || 'mock',
        txid,
        donationId,
      ]
    )

    logDev('create-charge', `Donation ${donationId} created`, { type, amount, txid })

    const charge = await pixProvider.createCharge({
      txid,
      amount,
      pixKey: streamerPixKey,
      payerName: donorName,
      payerEmail: undefined,
      description: `Doação Stream Pix - ${type}`,
    })

    await query(
      `UPDATE public.donations
       SET provider_payment_id = $1, pix_copia_e_cola = $2, qr_code = $3
       WHERE streamer_id = $4 AND donation_id = $5`,
      [charge.paymentId, charge.pixCopiaECola, charge.qrCode, streamerId, donationId]
    )

    return res.json({
      donationId,
      providerPaymentId: charge.paymentId,
      txid: charge.txid,
      qrCode: charge.qrCode,
      pixCopiaECola: charge.pixCopiaECola,
      status: 'pending',
      expiresIn: charge.expiresIn,
    })
  } catch (error) {
    console.error('[pix/create-charge] Error:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao criar cobrança Pix'
    return res.status(500).json({ error: msg })
  }
})

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value
      }
    }

    const webhookData = await pixProvider.verifyWebhook(req.body, headers)

    if (!webhookData.valid || !webhookData.txid || !webhookData.status) {
      return res.status(200).json({ status: 'ignored' })
    }

    const result = await query<{ id: string; amount: number; donor_name: string; status: string }>(
      'SELECT id, amount, donor_name, status FROM public.donations WHERE txid = $1',
      [webhookData.txid]
    )

    if (result.rows.length === 0) {
      logDev('webhook', `No donation found for txid: ${webhookData.txid}`)
      return res.status(200).json({ status: 'ignored' })
    }

    const donation = result.rows[0]

    if (donation.status === 'paid' || donation.status === 'played') {
      return res.json({ status: 'already_confirmed' })
    }

    if (webhookData.status === 'approved' || webhookData.status === 'authorized') {
      if (webhookData.amount && donation.amount) {
        const receivedAmount = typeof webhookData.amount === 'number' ? webhookData.amount : Number(webhookData.amount)
        if (Math.abs(receivedAmount - donation.amount) > 0.01) {
          await query(
            `UPDATE public.donations SET status = 'failed', failure_reason = $1 WHERE id = $2`,
            [`Valor recebido (${receivedAmount}) não confere com o esperado (${donation.amount})`, donation.id]
          )
          logDev('webhook', `Amount mismatch for ${webhookData.txid}`)
          return res.status(200).json({ status: 'amount_mismatch' })
        }
      }

      await query(
        `UPDATE public.donations
         SET status = 'paid', paid_at = now(), provider_status = $1, end_to_end_id = $2
         WHERE id = $3`,
        [webhookData.status, webhookData.endToEndId || null, donation.id]
      )

      logDev('webhook', `Donation ${webhookData.txid} confirmed as paid`, {
        amount: donation.amount,
        donorName: donation.donor_name,
      })

      return res.json({ status: 'confirmed' })
    }

    if (webhookData.status === 'rejected' || webhookData.status === 'cancelled') {
      await query(
        `UPDATE public.donations SET status = 'failed', provider_status = $1 WHERE id = $2`,
        [webhookData.status, donation.id]
      )
      logDev('webhook', `Donation ${webhookData.txid} ${webhookData.status}`)
      return res.json({ status: 'failed' })
    }

    return res.json({ status: webhookData.status })
  } catch (error) {
    console.error('[pix/webhook] Error:', error)
    return res.status(200).json({ status: 'error' })
  }
})

router.get('/donations/:streamerId', async (req: Request, res: Response) => {
  try {
    const { streamerId } = req.params
    const { status, type, isTest, limit = '50' } = req.query

    let sql = 'SELECT * FROM public.donations WHERE streamer_id = $1'
    const params: unknown[] = [streamerId]
    let paramIdx = 2

    if (status && typeof status === 'string') {
      sql += ` AND status = $${paramIdx}`
      params.push(status)
      paramIdx++
    }

    if (type && typeof type === 'string') {
      sql += ` AND donation_type = $${paramIdx}`
      params.push(type)
      paramIdx++
    }

    if (isTest !== undefined) {
      sql += ` AND is_test = $${paramIdx}`
      params.push(isTest === 'true')
      paramIdx++
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx}`
    params.push(Number(limit))

    const result = await query(sql, params)
    const donations = result.rows.map(doc => ({ id: doc.id, ...doc }))

    return res.json({ donations })
  } catch (error) {
    console.error('[pix/donations] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar doações' })
  }
})

router.post('/donations/:streamerId/:donationId/replay', async (req: Request, res: Response) => {
  try {
    const { streamerId, donationId } = req.params

    const result = await query(
      `UPDATE public.donations SET displayed = false, status = 'paid'
       WHERE streamer_id = $1 AND id::text = $2 RETURNING id`,
      [streamerId, donationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    logDev('replay', `Donation ${donationId} marked for replay`)
    return res.json({ status: 'queued_for_replay' })
  } catch (error) {
    console.error('[pix/replay] Error:', error)
    return res.status(500).json({ error: 'Erro ao reprocessar doação' })
  }
})

export default router
