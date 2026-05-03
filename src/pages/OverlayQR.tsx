import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";

export default function OverlayQR() {
  const { streamerId } = useParams<{ streamerId: string }>();
  const [qrDataUrl, setQrDataUrl] = useState("");

  const sendUrl = streamerId
    ? `${window.location.origin}/send/${streamerId}`
    : "";

  const generateQR = useCallback(() => {
    if (!sendUrl) return;
    QRCode.toDataURL(sendUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#0a1a12", light: "#F8FFFB" },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [sendUrl]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  if (!streamerId) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-transparent pointer-events-none overflow-hidden">
      <div
        className="animate-enter flex flex-col items-center gap-5 p-8 rounded-3xl backdrop-blur-xl border border-neon/15"
        style={{
          backgroundColor: "rgba(5, 8, 7, 0.75)",
          boxShadow:
            "0 0 40px rgba(0, 255, 136, 0.08), 0 0 80px rgba(0, 255, 136, 0.04), 0 8px 32px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <img
            src="/images/icone.png"
            alt="Stream Pix"
            className="w-20 h-20 object-contain"
          />
          <span className="text-4xl font-bold text-offwhite tracking-tight">
            Stream<span className="text-neon">Pix</span>
          </span>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-lg font-bold text-offwhite">
            Envie sua doação ao vivo
          </h1>
          <p className="text-sm text-sage/80 mt-1">
            Escaneie o QR Code ou acesse pelo celular
          </p>
        </div>

        {/* QR Code with glow */}
        <div className="relative">
          {/* Animated glow ring */}
          <div
            className="absolute -inset-3 rounded-2xl opacity-30 animate-pulse-slow"
            style={{
              background:
                "radial-gradient(circle, rgba(0, 255, 136, 0.15) 0%, transparent 70%)",
            }}
          />
          <div className="relative rounded-xl bg-white p-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code para doações"
                className="w-[280px] h-[280px]"
              />
            ) : (
              <div className="w-[280px] h-[280px] flex items-center justify-center text-sage/60 text-sm">
                Gerando...
              </div>
            )}
          </div>
        </div>

        {/* Footer text */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
            <span className="text-xs text-sage/70">
              Sua mensagem aparece na live em tempo real
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
