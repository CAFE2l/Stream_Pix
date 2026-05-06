import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import pixRoutes from "./routes/pix.js";
import { adminDb, isConfigured } from "./services/firebaseAdmin.js";

const app = express();
const PORT = process.env.PORT || 3001;

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server]", ...args);
  }
}

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs = 60000, maxRequests = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: "Muitas requisições. Tente novamente em breve.",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    entry.count++;
    next();
  };
}

app.use("/api/pix", rateLimit(60000, 20));

if (!isConfigured) {
  console.warn(
    "[Server] Firebase Admin não configurado — requisições ao /api/pix retornarão 503"
  );
}

app.use("/api/pix", pixRoutes);

app.post(
  "/api/dev/confirm-payment/:donationId",
  async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Endpoint indisponível em produção" });
    }

    if (!isConfigured) {
      return res
        .status(503)
        .json({ error: "Firebase Admin não configurado no backend" });
    }

    try {
      const { donationId } = req.params;
      const { streamerId } = req.body as { streamerId?: string };

      if (!streamerId) {
        return res.status(400).json({ error: "streamerId é obrigatório" });
      }

      const donationRef = adminDb
        .collection("users")
        .doc(streamerId)
        .collection("donations")
        .doc(String(donationId));
      const docSnap = await donationRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: "Doação não encontrada" });
      }

      const data = docSnap.data();
      if (data?.status === "paid") {
        return res.json({ status: "already_confirmed" });
      }

      await donationRef.update({
        status: "paid",
        paidAt: new Date().toISOString(),
        isTest: true,
      });

      logDev(`Donation ${donationId} marked as paid (DEV mode)`);
      return res.json({ status: "confirmed" });
    } catch (error) {
      console.error("[dev/confirm-payment] Error:", error);
      return res.status(500).json({ error: "Erro ao confirmar pagamento" });
    }
  }
);

app.post("/api/admin/confirm-payment", async (req: Request, res: Response) => {
  if (!isConfigured) {
    return res.status(503).json({ error: "Firebase Admin não configurado no backend" });
  }

  try {
    const { donationId, streamerId, adminToken } = req.body;

    if (!donationId || !streamerId) {
      return res.status(400).json({ error: "donationId e streamerId são obrigatórios" });
    }

    if (adminToken !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const donationRef = adminDb
      .collection("users")
      .doc(streamerId)
      .collection("donations")
      .doc(donationId);
    const docSnap = await donationRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Doação não encontrada" });
    }

    const data = docSnap.data();
    if (data?.status === "paid") {
      return res.json({ status: "already_confirmed" });
    }

    await donationRef.update({
      status: "paid",
      paidAt: new Date().toISOString(),
      isTest: true,
    });

    logDev(`Donation ${donationId} marked as paid (admin)`);
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
    firebaseAdmin: isConfigured ? "configured" : "not_configured",
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Stream Pix API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());
