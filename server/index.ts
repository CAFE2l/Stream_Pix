import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import pixRoutes from "./routes/pix.js";
import cryptoRoutes from "./routes/crypto.js";
import settingsRoutes from "./routes/settings.js";
import donationsRoutes from "./routes/donations.js";
import { startCryptoMonitor } from "./services/cryptoProvider.js";
import { query } from "./services/db.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.use("/api/settings", settingsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/pix", pixRoutes);
app.use("/api/crypto", cryptoRoutes);

startCryptoMonitor();

app.post(
  "/api/dev/confirm-payment/:donationId",
  async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Endpoint indisponível em produção" });
    }

    try {
      const { donationId } = req.params;
      const { streamerId } = req.body as { streamerId?: string };

      if (!streamerId) {
        return res.status(400).json({ error: "streamerId é obrigatório" });
      }

      const result = await query<{ id: string; status: string }>(
        `SELECT id, status FROM public.donations
         WHERE streamer_id = $1 AND id::text = $2`,
        [streamerId, donationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Doação não encontrada" });
      }

      const donation = result.rows[0];
      if (donation.status === "paid") {
        return res.json({ status: "already_confirmed" });
      }

      await query(
        `UPDATE public.donations
         SET status = 'paid', paid_at = now()
         WHERE id = $1`,
        [donation.id]
      );

      console.log(`[DEV] Donation ${donationId} marked as paid`);
      return res.json({ status: "confirmed" });
    } catch (error) {
      console.error("[dev/confirm-payment] Error:", error);
      return res.status(500).json({ error: "Erro ao confirmar pagamento" });
    }
  },
);

app.post("/api/admin/confirm-payment", async (req: Request, res: Response) => {
  try {
    const { donationId, streamerId, adminToken } = req.body;

    if (adminToken !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const result = await query<{ id: string; status: string }>(
      `SELECT id, status FROM public.donations
       WHERE streamer_id = $1 AND id::text = $2`,
      [streamerId, donationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Doação não encontrada" });
    }

    const donation = result.rows[0];
    if (donation.status === "paid") {
      return res.json({ status: "already_confirmed" });
    }

    await query(
      `UPDATE public.donations
       SET status = 'paid', paid_at = now()
       WHERE id = $1`,
      [donation.id]
    );

    return res.json({ status: "confirmed" });
  } catch (error) {
    console.error("[admin/confirm-payment] Error:", error);
    return res.status(500).json({ error: "Erro ao confirmar pagamento" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    port: PORT,
    database: "neon_postgres",
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Stream Pix API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());
