import { Router, Request, Response } from 'express'
import { query } from '../services/db.js'

const router = Router()

interface DonationRow {
  id: string
  streamer_id: string
  donor_name: string
  amount: number
  donation_type: string
  message: string
  audio_url: string | null
  video_url: string | null
  cloudinary_public_id: string | null
  status: string
  is_test: boolean
  displayed: boolean
  provider: string
  provider_payment_id: string | null
  provider_status: string | null
  txid: string | null
  pix_copia_e_cola: string | null
  qr_code: string | null
  end_to_end_id: string | null
  crypto_transaction_id: string | null
  failure_reason: string | null
  paid_at: string | null
  played_at: string | null
  created_at: string
  updated_at: string
  donation_id: string | null
  streamer_id_ref: string | null
}

function rowToDonation(row: DonationRow) {
  return {
    id: row.id,
    donorName: row.donor_name,
    amount: Number(row.amount),
    type: row.donation_type,
    message: row.message,
    audioUrl: row.audio_url,
    videoUrl: row.video_url,
    cloudinaryPublicId: row.cloudinary_public_id,
    status: row.status,
    isTest: row.is_test,
    displayed: row.displayed,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    providerStatus: row.provider_status,
    txid: row.txid,
    pixCopiaECola: row.pix_copia_e_cola,
    qrCode: row.qr_code,
    endToEndId: row.end_to_end_id,
    failureReason: row.failure_reason,
    paidAt: row.paid_at,
    playedAt: row.played_at,
    createdAt: row.created_at,
    donationId: row.donation_id,
    streamerId: row.streamer_id,
  }
}

router.get('/:streamerId', async (req: Request, res: Response) => {
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

    const result = await query<DonationRow>(sql, params)
    return res.json({ donations: result.rows.map(rowToDonation) })
  } catch (error) {
    console.error('[donations/get] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar doações' })
  }
})

router.get('/:streamerId/overlay', async (req: Request, res: Response) => {
  try {
    const { streamerId } = req.params

    const result = await query<DonationRow>(
      `SELECT * FROM public.donations
       WHERE streamer_id = $1 AND status = 'paid' AND displayed = false
       ORDER BY created_at ASC`,
      [streamerId]
    )

    return res.json({ donations: result.rows.map(rowToDonation) })
  } catch (error) {
    console.error('[donations/overlay] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar doações do overlay' })
  }
})

router.patch('/:streamerId/:donationId', async (req: Request, res: Response) => {
  try {
    const { streamerId, donationId } = req.params
    const updates = req.body

    const allowedFields: Record<string, string> = {
      status: 'status',
      displayed: 'displayed',
      paidAt: 'paid_at',
      playedAt: 'played_at',
      providerPaymentId: 'provider_payment_id',
      pixCopiaECola: 'pix_copia_e_cola',
      qrCode: 'qr_code',
      failureReason: 'failure_reason',
      providerStatus: 'provider_status',
      endToEndId: 'end_to_end_id',
      isTest: 'is_test',
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    for (const [key, value] of Object.entries(updates)) {
      const col = allowedFields[key]
      if (col) {
        setClauses.push(`${col} = $${paramIdx}`)
        params.push(value)
        paramIdx++
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    }

    params.push(streamerId, donationId)

    const result = await query(
      `UPDATE public.donations
       SET ${setClauses.join(', ')}
       WHERE streamer_id = $${paramIdx} AND id::text = $${paramIdx + 1}
       RETURNING id`,
      params
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    return res.json({ ok: true })
  } catch (error) {
    console.error('[donations/patch] Error:', error)
    return res.status(500).json({ error: 'Erro ao atualizar doação' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      streamerId,
      donorName,
      amount,
      type,
      message,
      audioUrl,
      videoUrl,
      cloudinaryPublicId,
      status,
      isTest,
      provider,
      txid,
      donationId,
      pixCopiaECola,
      qrCode,
      providerPaymentId,
    } = req.body

    if (!streamerId || !amount || !type) {
      return res.status(400).json({ error: 'streamerId, amount e type são obrigatórios' })
    }

    const result = await query<DonationRow>(
      `INSERT INTO public.donations (
        streamer_id, donor_name, amount, donation_type, message,
        audio_url, video_url, cloudinary_public_id, status, is_test,
        provider, txid, donation_id, pix_copia_e_cola, qr_code,
        provider_payment_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        streamerId,
        donorName || 'Anônimo',
        amount,
        type,
        message || '',
        audioUrl || null,
        videoUrl || null,
        cloudinaryPublicId || null,
        status || 'pending',
        isTest ?? false,
        provider || 'mock',
        txid || null,
        donationId || null,
        pixCopiaECola || null,
        qrCode || null,
        providerPaymentId || null,
      ]
    )

    return res.json({ donation: rowToDonation(result.rows[0]) })
  } catch (error) {
    console.error('[donations/post] Error:', error)
    return res.status(500).json({ error: 'Erro ao criar doação' })
  }
})

router.get('/txid/:txid', async (req: Request, res: Response) => {
  try {
    const { txid } = req.params

    const result = await query<DonationRow>(
      'SELECT * FROM public.donations WHERE txid = $1',
      [txid]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    return res.json({ donation: rowToDonation(result.rows[0]) })
  } catch (error) {
    console.error('[donations/txid] Error:', error)
    return res.status(500).json({ error: 'Erro ao buscar doação' })
  }
})

router.post('/replay/:streamerId/:donationId', async (req: Request, res: Response) => {
  try {
    const { streamerId, donationId } = req.params

    const result = await query(
      `UPDATE public.donations
       SET displayed = false, status = 'paid'
       WHERE streamer_id = $1 AND id::text = $2
       RETURNING id`,
      [streamerId, donationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doação não encontrada' })
    }

    return res.json({ status: 'queued_for_replay' })
  } catch (error) {
    console.error('[donations/replay] Error:', error)
    return res.status(500).json({ error: 'Erro ao reprocessar doação' })
  }
})

export default router
