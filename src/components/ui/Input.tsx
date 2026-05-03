type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function Input({ className = '', ...props }: Props) {
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-surface/60 border border-border text-offwhite text-sm placeholder:text-sage-muted/50 focus:outline-none focus:border-neon/40 focus:ring-1 focus:ring-neon/20 transition-all duration-200 ${className}`}
    />
  )
}
