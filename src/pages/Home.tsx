import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient bg-grid-fine">
      <Navbar />

      {/* ════════════════ HERO ════════════════ */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neon/20 bg-neon/5 text-neon text-xs font-semibold tracking-wide uppercase mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
            Tempo real · Firebase · OBS
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-offwhite">Alertas de </span>
            <span className="text-gradient-shimmer">Pix</span>
            <br />
            <span className="text-offwhite">para sua </span>
            <span className="text-gradient">live</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base md:text-lg text-sage max-w-xl mx-auto leading-relaxed">
            Configure alertas visuais de doações em segundos.
            Cole a URL no OBS e veja a mágica acontecer.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-neon to-cyan text-bg font-semibold text-base shadow-neon hover:shadow-glow-lg transition-all duration-300 active:scale-[0.98]"
            >
              Começar agora
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-border text-offwhite font-medium text-base hover:border-neon/30 hover:bg-neon/5 transition-all duration-300"
            >
              Já tenho conta
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-sage-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Setup em 2 min
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Firebase Auth
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              OBS Ready
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ COMO FUNCIONA ════════════════ */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-neon tracking-widest uppercase">Como funciona</span>
            <h2 className="mt-3 text-2xl md:text-4xl font-bold text-offwhite tracking-tight">
              Três passos. Zero complicação.
            </h2>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2-5a4.5 4.5 0 00-4.5 4.5v9a4.5 4.5 0 004.5 4.5h6a4.5 4.5 0 004.5-4.5v-9a4.5 4.5 0 00-4.5-4.5h-6zM4 7.5v3m0 0v3m0-3H1m3 0H1m2-5a4.5 4.5 0 00-4.5 4.5v9a4.5 4.5 0 004.5 4.5h6a4.5 4.5 0 004.5-4.5v-9a4.5 4.5 0 00-4.5-4.5H6z" />
                  </svg>
                ),
                step: '01',
                title: 'Crie sua conta',
                desc: 'Cadastro gratuito com email e senha. Acesso imediato ao dashboard.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                step: '02',
                title: 'Configure o alerta',
                desc: 'Personalize texto, cor, duração. Preview em tempo real no dashboard.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                ),
                step: '03',
                title: 'Cole no OBS',
                desc: 'Adicione a URL como Browser Source. Pronto. Alertas ao vivo.',
              },
            ].map(({ icon, step, title, desc }) => (
              <div
                key={step}
                className="relative p-6 rounded-2xl bg-surface/40 border border-border hover:border-neon/15 transition-all duration-300 hover:bg-surface/60"
              >
                <div className="absolute top-4 right-4 text-[10px] font-black text-sage-muted/30 tracking-widest">
                  {step}
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-neon/10 to-cyan/10 border border-neon/10 flex items-center justify-center text-neon mb-4">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-offwhite tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-sage leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FEATURES ════════════════ */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-neon tracking-widest uppercase">Features</span>
            <h2 className="mt-3 text-2xl md:text-4xl font-bold text-offwhite tracking-tight">
              Tudo que você precisa.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: 'Tempo real',
                desc: 'Alertas instantâneos via Firebase Firestore. Sem delay.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  </svg>
                ),
                title: 'Customizável',
                desc: 'Texto, cores e duração. Totalmente sob seu controle.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                ),
                title: 'OBS Ready',
                desc: 'Browser Source com fundo transparente. Plug & play.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-1.528c-.362.362-.622.814-.756 1.318z" />
                  </svg>
                ),
                title: 'Seguro',
                desc: 'Autenticação Firebase. Suas configurações protegidas.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                ),
                title: 'Simulador',
                desc: 'Teste alertas antes de ir ao vivo. Sem risco.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                ),
                title: 'Responsivo',
                desc: 'Dashboard perfeito em qualquer dispositivo.',
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="p-5 rounded-2xl bg-surface/30 border border-border hover:border-neon/15 hover:bg-surface/50 transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-lg bg-neon/5 border border-neon/10 flex items-center justify-center text-neon mb-3">
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-offwhite tracking-tight">{title}</h3>
                <p className="mt-1 text-xs text-sage leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ CTA ════════════════ */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 sm:p-14 rounded-3xl border border-neon/10 bg-gradient-to-b from-darkgreen/50 to-surface/80">
            <h2 className="text-2xl md:text-3xl font-bold text-offwhite tracking-tight">
              Pronto para elevar suas lives?
            </h2>
            <p className="mt-4 text-sage text-base max-w-md mx-auto">
              Crie sua conta gratuita e configure seu primeiro alerta em menos de 2 minutos.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-neon to-cyan text-bg font-semibold text-base shadow-neon hover:shadow-glow-lg transition-all duration-300 active:scale-[0.98]"
            >
              Criar conta grátis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sage-muted">
          <span>© 2026 Stream Pix</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon/50" />
            Feito para streamers brasileiros
          </span>
        </div>
      </footer>
    </div>
  )
}
