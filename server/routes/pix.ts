import { Router, Request, Response } from 'express'
import { adminDb, isConfigured } from '../services/firebaseAdmin.js'
import { pixProvider } from '../services/pixProvider.js'
import crypto from 'crypto'

const router = Router()

router.post('/create-charge', async (req: Request, res: Response) => {
  try {
    const { streamerId, amount, type, name, message, mediaUrl, mediaType } = req.body

    if (!streamerId || !amount || !type) {
      return res.status(400).json({ error: 'streamerId, amount e type são obrigatórios' })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount deve ser um número positivo' })
    }

    if (!isConfigured) {
      return res.status(503).json({
        error: 'Firebase Admin não configurado no backend. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no server/.env',
      })
    }

    const donationId = crypto.randomUUID()
    const txid = `sp_${streamerId.slice(0, 6)}_${donationId.slice(0, 8)}`.replace(/-/g, '').toLowerCase()

    const donationData = {
      donorName: name?.trim() || 'Anônimo',
      amount,
      type,
      message: message?.trim() || '',
      audioUrl: mediaType === 'audio' ? mediaUrl || null : null,
      videoUrl: mediaType === 'video' ? mediaUrl || null : null,
      status: 'pending' as const,
      isTest: false,
      createdAt: new Date().toISOString(),
      paidAt: null,
      txid,
      donationId,
      streamerId,
      displayed: false,
    }

    await adminDb.collection('users').doc(streamerId).collection('donations').doc(donationId).set(donationData)

    const charge = await pixProvider.createCharge({
      txid,
      amount,
      payerName: donationData.donorName,
      description: `Doação Stream Pix - ${type}`,
    })

    return res.json({
      donationId,
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

    if (!webhookData.valid || !webhookData.txid) {
      return res.status(400).json({ error: 'Webhook inválido' })
    }

    const donationsRef = adminDb.collectionGroup('donations')
    const snapshot = await donationsRef.where('txid', '==', webhookData.txid).get()

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    const docSnap = snapshot.docs[0]
    const donationData = docSnap.data()

    if (donationData.status === 'paid') {
      return res.json({ status: 'already_confirmed' })
    }

    if (webhookData.amount && Math.abs(webhookData.amount - donationData.amount) > 0.01) {
      await docSnap.ref.update({
        status: 'failed',
        paidAt: null,
        failureReason: 'Valor recebido não confere',
      })
      return res.status(400).json({ error: 'Valor não confere' })
    }

    await docSnap.ref.update({
      status: 'paid',
      paidAt: new Date().toISOString(),
      endToEndId: webhookData.endToEndId || null,
    })

    console.log(`[Webhook] Donation ${webhookData.txid} marked as paid`)
    return res.json({ status: 'confirmed' })
  } catch (error) {
    console.error('[pix/webhook] Error:', error)
    return res.status(500).json({ error: 'Erro ao processar webhook' })
  }
})

export default router
