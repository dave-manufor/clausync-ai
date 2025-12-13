import { Outlet } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-[#5814BA] opacity-10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-[#A17CFF] opacity-10 blur-[120px] rounded-full" />
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md mx-4 relative z-10 bg-card/80 backdrop-blur-xl border-border">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#5814BA] to-[#A17CFF] bg-clip-text text-transparent">
              Clausync
            </h1>
            <p className="text-muted-foreground mt-2">
              AI-powered contract monitoring
            </p>
          </div>

          <Outlet />
        </CardContent>
      </Card>
    </div>
  )
}
