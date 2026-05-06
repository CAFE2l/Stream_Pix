import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db, serverTimestamp } from '../services/firebase'
import Navbar from '../components/layout/Navbar'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Toast from '../components/ui/Toast'

export default function SimulatePix() {
  const { userId } = useParams<{ userId: string }>()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setLoading(true)
    try {
      const col = collection(db, 'users', userId, 'donations')
      await addDoc(col, {
        donorName: name || 'Anônimo',
        amount: parseFloat(amount) || 0,
        type: 'text',
        message,
        status: 'paid',
        isTest: true,
        createdAt: serverTimestamp(),
        displayed: false,
        txid: `test_${Date.now()}`,
        donationId: crypto.randomUUID(),
        streamerId: userId,
      })
      setName('')
      setAmount('')
      setMessage('')
      setToast('Doação enviada com sucesso!')
    } catch {
      setToast('Erro ao enviar doação')
    } finally {
      setLoading(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="min-h-screen bg-gradient bg-grid-fine flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 pt-16">
        <Card className="max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon/10 to-cyan/10 border border-neon/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-offwhite tracking-tight">Simular Pix</h2>
            <p className="mt-1.5 text-sm text-sage">Cria uma doação de teste no Firestore</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-sage mb-1.5">Nome do doador</label>
              <Input
                placeholder="Nome ou Anônimo"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sage mb-1.5">Valor (R$)</label>
              <Input
                type="number"
                placeholder="25.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={0.01}
                step={0.01}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sage mb-1.5">Mensagem</label>
              <Input
                placeholder="Mensagem opcional"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                'Enviar doação'
              )}
            </Button>
          </form>
        </Card>
      </div>

      {toast && <Toast message={toast} onClose={clearToast} />}
    </div>
  )
}
