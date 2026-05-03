import { useEffect, useState } from 'react'

type ToastVariant = 'success' | 'error'

export default function Toast({ message, variant = 'success', onClose }: { message: string; variant?: ToastVariant; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const borderClass = variant === 'success' ? 'border-neon' : 'border-red-500'
  const textClass = variant === 'success' ? 'text-offwhite' : 'text-red-300'
  const bgClass = variant === 'success' ? 'bg-darkgreen' : 'bg-red-950/80'

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border ${borderClass} ${bgClass} ${textClass} text-sm font-medium shadow-neon transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {message}
    </div>
  )
}
