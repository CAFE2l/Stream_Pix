export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass glass-hover p-6 ${className}`}>
      {children}
    </div>
  )
}
