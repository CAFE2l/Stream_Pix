import { adminDb, isConfigured } from "./firebaseAdmin.js";
import * as crypto from "crypto";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRON_GRID = "https://api.trongrid.io";

let tronGridApiKey = process.env.TRONGRID_API_KEY || "";

interface PendingCharge {
  txid: string;
  streamerId: string;
  amount: number;
  payerName: string;
  createdAt: number;
}

async function checkUsdtTransfers(): Promise<void> {
  if (!isConfigured) return;
  if (!process.env.TRON_USDT_ADDRESS) return;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tronGridApiKey) headers["TRON-PRO-API-KEY"] = tronGridApiKey;

    const url = `${TRON_GRID}/v1/accounts/${process.env.TRON_USDT_ADDRESS}/transactions/trc20?contract_address=${USDT_CONTRACT}&only_to=true&limit=50&min_timestamp=${Date.now() - 600000}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return;

    const data = await res.json();
    const transfers = data.data || [];

    for (const tx of transfers) {
      const value = Number(tx.value) / 1_000_000;
      const txId = tx.transaction_id;

      const snapshot = await adminDb
        .collectionGroup("donations")
        .where("paid", "==", false)
        .where("amount", "==", value)
        .where("provider", "==", "crypto")
        .get();

      if (snapshot.empty) continue;

      for (const doc of snapshot.docs) {
        await doc.ref.update({
          paid: true,
          paidAt: new Date().toISOString(),
          cryptoConfirmedAt: new Date().toISOString(),
          cryptoTransactionId: txId,
          status: "approved",
        });
      }
    }
  } catch (err) {
    console.error("[CryptoMonitor] Error checking USDT:", err);
  }
}

export function startCryptoMonitor(): void {
  if (!process.env.TRON_USDT_ADDRESS) {
    console.warn("[CryptoMonitor] TRON_USDT_ADDRESS not set, skipping monitor");
    return;
  }
  console.log("[CryptoMonitor] Starting USDT monitor for", process.env.TRON_USDT_ADDRESS);
  checkUsdtTransfers();
  setInterval(checkUsdtTransfers, 30_000);
}

export function createCryptoCharge(txid: string, amount: number): {
  address: string;
  amount: number;
  asset: string;
  network: string;
} {
  if (!process.env.TRON_USDT_ADDRESS) {
    throw new Error("TRON_USDT_ADDRESS não configurado no .env");
  }
  return {
    address: process.env.TRON_USDT_ADDRESS,
    amount,
    asset: "USDT",
    network: "TRC-20",
  };
}
