import { Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Search,
  Menu,
  PanelLeftOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@clausync/ui'
import { Input } from '@clausync/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@clausync/ui'
import { Sheet, SheetContent, SheetTrigger } from '@clausync/ui'
import { Avatar, AvatarFallback } from '@clausync/ui'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground selection:bg-accent/30">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[70px]' : 'w-[280px]'
        }`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Top Bar */}
        <header className="h-16 border-b border-border/40 glass flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          
          {/* Mobile Menu Trigger & Search */}
          <div className="flex items-center gap-4 flex-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-muted-foreground">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 border-r border-border w-[280px] bg-surface-1">
                <Sidebar isMobile onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* Desktop Expand Sidebar Button - visible when collapsed */}
            {collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="hidden md:flex -ml-2 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}

            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Search..."
                className="pl-9 h-9 bg-surface-2/50 border-white/5 focus-visible:bg-surface-2 transition-all rounded-full"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-critical rounded-full border-2 border-background" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full ring-2 ring-transparent hover:ring-accent/50 transition-all">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-medium text-xs">
                      JD
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-surface-1 border-border">
                <div className="p-2 border-b border-border/50 mb-1">
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">john@clausync.ai</p>
                </div>
                <DropdownMenuItem className="cursor-pointer focus:bg-surface-2">
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer focus:bg-surface-2">
                  Team Members
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer focus:bg-surface-2">
                  Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem className="text-critical focus:text-critical cursor-pointer focus:bg-critical/10">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
