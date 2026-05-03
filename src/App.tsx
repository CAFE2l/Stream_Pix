import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Overlay from './pages/Overlay'
import SimulatePix from './pages/SimulatePix'
import SendDonation from './pages/SendDonation'
import OverlayQR from './pages/OverlayQR'
import ProtectedRoute from './components/ProtectedRoute'
import { isConfigured } from './services/firebase'

function SetupWarning() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-8 rounded-2xl border border-red-500/30 bg-red-950/20">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Firebase não configurado</h1>
        <p className="text-sage mb-4">
          O projeto precisa de credenciais Firebase para funcionar. Siga os passos:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-offwhite">
          <li>Acesse <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-neon underline">console.firebase.google.com</a></li>
          <li>Crie um novo projeto (ou use um existente)</li>
          <li>Vá em <strong>Project settings</strong> ⚙️ → Role até <strong>Your apps</strong></li>
          <li>Clique no ícone <strong>&lt;/&gt;</strong> (web app) e registre</li>
          <li>Copie as 6 variáveis do <code>firebaseConfig</code></li>
          <li>Cole no arquivo <code>.env</code> na raiz do projeto</li>
          <li>Reinicie o dev server (<code>Ctrl+C</code> depois <code>npm run dev</code>)</li>
        </ol>
        <p className="mt-4 text-xs text-sage">
          Depois ative <strong>Authentication</strong> (Email/Password) e crie o <strong>Firestore Database</strong> no console.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) {
    return <SetupWarning />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/overlay/:userId" element={<Overlay />} />
        <Route path="/simulate/:userId" element={<SimulatePix />} />
        <Route path="/send/:streamerId" element={<SendDonation />} />
        <Route path="/overlay/qr/:streamerId" element={<OverlayQR />} />
      </Routes>
    </BrowserRouter>
  )
}
