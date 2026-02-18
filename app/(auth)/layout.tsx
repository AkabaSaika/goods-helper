export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-accent/30 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
