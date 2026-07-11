import { Router, Request, Response } from "express";
import { query } from "../services/db.js";
import { createCryptoCharge } from "../services/cryptoProvider.js";

const router = Router();

router.post("/create-charge", async (req: Request, res: Response) => {
  try {
    const { txid, amount, payerName, streamerId } = req.body;

    if (!txid || !amount || !payerName || !streamerId) {
      return res.status(400).json({ error: "Campos obrigatórios: txid, amount, payerName, streamerId" });
    }

    const charge = createCryptoCharge(txid, amount);

    await query(
      `UPDATE public.donations
       SET provider = 'crypto', crypto_transaction_id = $1
       WHERE streamer_id = $2 AND txid = $3`,
      [charge.address, streamerId, txid]
    );

    return res.json({
      txid,
      address: charge.address,
      amount,
      asset: charge.asset,
      network: charge.network,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar cobrança crypto";
    return res.status(500).json({ error: msg });
  }
});

export default router;
