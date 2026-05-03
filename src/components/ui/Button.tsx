type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export default function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]'

  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-neon to-cyan text-bg shadow-neon hover:shadow-glow-lg hover:brightness-110 hover:-translate-y-0.5',
    secondary:
      'bg-surface border border-border text-offwhite hover:border-neon/30 hover:bg-surface-hover hover:shadow-neon',
    ghost:
      'bg-transparent text-sage hover:text-offwhite hover:bg-white/5 border border-transparent hover:border-border',
    danger:
      'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
