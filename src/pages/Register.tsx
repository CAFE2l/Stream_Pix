import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Navbar from '../components/layout/Navbar'
import Toast from '../components/ui/Toast'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleRegister() {
    setError(null)
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao cadastrar com Google'
      setError(message)
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient bg-grid-fine flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm">
          <div className="glass p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon/10 to-cyan/10 border border-neon/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2-5a4.5 4.5 0 00-4.5 4.5v9a4.5 4.5 0 004.5 4.5h6a4.5 4.5 0 004.5-4.5v-9a4.5 4.5 0 00-4.5-4.5h-6zM4 7.5v3m0 0v3m0-3H1m3 0H1m2-5a4.5 4.5 0 00-4.5 4.5v9a4.5 4.5 0 004.5 4.5h6a4.5 4.5 0 004.5-4.5v-9a4.5 4.5 0 00-4.5-4.5H6z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-offwhite tracking-tight">Crie sua conta</h2>
              <p className="mt-1.5 text-sm text-sage">Comece a usar alertas Pix na sua live</p>
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface/60 text-offwhite text-sm font-medium hover:bg-surface-hover hover:border-neon/15 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-4"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-sage-muted/30 border-t-neon rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? 'Conectando...' : 'Cadastrar com Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-sage-muted">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-sage mb-1.5">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-sage mb-1.5">Senha</label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <div className="px-3.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-sage">
              Já tem conta?{' '}
              <Link to="/login" className="text-neon hover:text-cyan font-medium transition-colors">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {error && <Toast message={error} variant="error" onClose={() => setError(null)} />}
    </div>
  )
}
