import { Link, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import icone from '../../assets/images/icone.png'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isOverlay = location.pathname.startsWith('/overlay')

  if (isOverlay) return null

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <img src={icone} alt="Stream Pix logo" className="w-8 h-8 object-contain" />
          <span className="text-lg font-bold text-offwhite tracking-tight">
            Stream<span className="text-neon">Pix</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  location.pathname === '/dashboard'
                    ? 'text-neon bg-neon/5'
                    : 'text-sage hover:text-offwhite'
                }`}
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-sage hover:text-red-400 transition-colors duration-200"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-sage hover:text-offwhite transition-colors duration-200"
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="ml-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-neon to-cyan text-bg shadow-neon hover:shadow-glow-lg transition-all duration-300"
              >
                Cadastrar
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
