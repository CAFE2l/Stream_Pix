import type { DonationType } from '../../types'

type DonationTypeCardProps = {
  type: DonationType
  icon: React.ReactNode
  title: string
  desc: string
  min: string
  selected: boolean
  onClick: () => void
}

export default function DonationTypeCard({ icon, title, desc, min, selected, onClick }: DonationTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? 'border-neon/40 bg-neon/5 shadow-[0_0_20px_rgba(0,255,136,0.1)]'
          : 'border-border bg-surface/40 hover:border-neon/15 hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            selected ? 'bg-neon/20 text-neon' : 'bg-surface-hover text-sage'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${selected ? 'text-offwhite' : 'text-sage'}`}>{title}</div>
          <div className="text-xs text-sage-muted mt-0.5 leading-relaxed">{desc}</div>
          <div className={`text-xs font-medium mt-2 ${selected ? 'text-neon' : 'text-sage-muted'}`}>{min}</div>
        </div>
      </div>
    </button>
  )
}
