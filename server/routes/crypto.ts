import { Router, Request, Response } from "express";
import { adminDb, isConfigured } from "../services/firebaseAdmin.js";
import { createCryptoCharge } from "../services/cryptoProvider.js";

const router = Router();

router.post("/create-charge", async (req: Request, res: Response) => {
  try {
    if (!isConfigured) {
      return res.status(503).json({ error: "Firebase Admin não configurado" });
    }

    const { txid, amount, payerName, streamerId } = req.body;

    if (!txid || !amount || !payerName || !streamerId) {
      return res.status(400).json({ error: "Campos obrigatórios: txid, amount, payerName, streamerId" });
    }

    const charge = createCryptoCharge(txid, amount);

    await adminDb
      .collection("users")
      .doc(streamerId)
      .collection("donations")
      .doc(txid)
      .update({
        provider: "crypto",
        cryptoAddress: charge.address,
        cryptoAsset: charge.asset,
        cryptoNetwork: charge.network,
      });

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
