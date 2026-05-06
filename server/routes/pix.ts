import { Router, Request, Response } from 'express'
import { adminDb, isConfigured } from '../services/firebaseAdmin.js'
import { pixProvider } from '../services/pixProvider.js'
import crypto from 'crypto'

const router = Router()

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'stream-pix-webhook-secret'

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

    if (!isConfigured) {
      return res.status(503).json({ error: 'Firebase Admin não configurado no backend.' })
    }

    const donationId = crypto.randomUUID()
    const txid = `sp_${streamerId.slice(0, 6)}_${donationId.slice(0, 8)}`.replace(/-/g, '').toLowerCase()

    const donationData = {
      donorName: name?.trim() || 'Anônimo',
      amount,
      type,
      message: message?.trim() || '',
      audioUrl: type === 'audio' ? (mediaUrl || null) : null,
      videoUrl: type === 'video' ? (mediaUrl || null) : null,
      cloudinaryPublicId: cloudinaryPublicId || null,
      status: 'pending' as const,
      isTest: false,
      provider: process.env.PIX_PROVIDER || 'mock',
      providerPaymentId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      txid,
      donationId,
      streamerId,
      displayed: false,
    }

    await adminDb.collection('users').doc(streamerId).collection('donations').doc(donationId).set(donationData)

    logDev('create-charge', `Donation ${donationId} created`, { type, amount, txid })

    const charge = await pixProvider.createCharge({
      txid,
      amount,
      payerName: donationData.donorName,
      payerEmail: undefined,
      description: `Doação Stream Pix - ${type}`,
    })

    await adminDb.collection('users').doc(streamerId).collection('donations').doc(donationId).update({
      providerPaymentId: charge.paymentId,
      pixCopiaECola: charge.pixCopiaECola,
      qrCode: charge.qrCode,
    })

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
    if (!isConfigured) {
      return res.status(503).json({ error: 'Firebase Admin não configurado' })
    }

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

    const donationsRef = adminDb.collectionGroup('donations')
    const snapshot = await donationsRef.where('txid', '==', webhookData.txid).get()

    if (snapshot.empty) {
      logDev('webhook', `No donation found for txid: ${webhookData.txid}`)
      return res.status(200).json({ status: 'ignored' })
    }

    const docSnap = snapshot.docs[0]
    const donationData = docSnap.data()

    if (donationData.status === 'paid' || donationData.status === 'played') {
      return res.json({ status: 'already_confirmed' })
    }

    if (webhookData.status === 'approved' || webhookData.status === 'authorized') {
      if (webhookData.amount && donationData.amount) {
        const receivedAmount = typeof webhookData.amount === 'number' ? webhookData.amount : Number(webhookData.amount)
        if (Math.abs(receivedAmount - donationData.amount) > 0.01) {
          await docSnap.ref.update({
            status: 'failed',
            failureReason: `Valor recebido (${receivedAmount}) não confere com o esperado (${donationData.amount})`,
          })
          logDev('webhook', `Amount mismatch for ${webhookData.txid}`)
          return res.status(200).json({ status: 'amount_mismatch' })
        }
      }

      await docSnap.ref.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
        providerStatus: 'approved',
        endToEndId: webhookData.endToEndId || null,
      })

      logDev('webhook', `Donation ${webhookData.txid} confirmed as paid`, {
        amount: donationData.amount,
        donorName: donationData.donorName,
      })

      return res.json({ status: 'confirmed' })
    }

    if (webhookData.status === 'rejected' || webhookData.status === 'cancelled') {
      await docSnap.ref.update({
        status: 'failed',
        providerStatus: webhookData.status,
      })
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
    const { status, type, isTest, limit = 50 } = req.query

    if (!isConfigured) {
      return res.status(503).json({ error: 'Firebase Admin não configurado' })
    }

    const donationsRef = adminDb.collection('users').doc(streamerId).collection('donations')
    let query = donationsRef.orderBy('createdAt', 'desc')

    if (status && typeof status === 'string') {
      query = query.where('status', '==', status)
    }

    if (type && typeof type === 'string') {
      query = query.where('type', '==', type)
    }

    if (isTest !== undefined) {
      query = query.where('isTest', '==', isTest === 'true')
    }

    const snapshot = await query.limit(Number(limit)).get()
    const donations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    return res.json({ donations })
  } catch (error) {
    console.error('[pix/donations] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar doações' })
  }
})

router.post('/donations/:streamerId/:donationId/replay', async (req: Request, res: Response) => {
  try {
    const { streamerId, donationId } = req.params

    if (!isConfigured) {
      return res.status(503).json({ error: 'Firebase Admin não configurado' })
    }

    const donationRef = adminDb.collection('users').doc(streamerId).collection('donations').doc(donationId)
    const docSnap = await donationRef.get()

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    await donationRef.update({ displayed: false, status: 'paid' })

    logDev('replay', `Donation ${donationId} marked for replay`)
    return res.json({ status: 'queued_for_replay' })
  } catch (error) {
    console.error('[pix/replay] Error:', error)
    return res.status(500).json({ error: 'Erro ao reprocessar doação' })
  }
})

export default router
