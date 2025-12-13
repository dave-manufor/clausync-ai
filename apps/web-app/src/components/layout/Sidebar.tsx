import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileSearch,
  Activity,
  Settings,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LogOut,
  ChevronsUpDown,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
// ThemeToggle import removed - component kept for future use

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean
  setCollapsed?: (collapsed: boolean) => void
  isMobile?: boolean
  onNavigate?: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, badge: null },
  { name: 'Monitors', href: '/monitors', icon: FileSearch, badge: '24' },
  { name: 'Changes', href: '/changes', icon: Activity, badge: '3' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, badge: null },
  { name: 'Settings', href: '/settings', icon: Settings, badge: null },
]

// Mock monitored vendors for the "Risk Pulse" section
const monitoredVendors = [
  { name: 'AWS', status: 'safe' as const, href: '/monitors/1' },
  { name: 'Stripe', status: 'warning' as const, href: '/monitors/2' },
  { name: 'GitHub', status: 'safe' as const, href: '/monitors/3' },
  { name: 'Notion', status: 'critical' as const, href: '/monitors/4' },
]

const statusConfig = {
  safe: {
    color: 'bg-emerald-500',
    glow: '',
    ring: 'ring-emerald-500/20',
  },
  warning: {
    color: 'bg-amber-400',
    glow: '',
    ring: 'ring-amber-400/20',
  },
  critical: {
    color: 'bg-red-500',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
    ring: 'ring-red-500/20',
  },
}

export function Sidebar({ 
  className, 
  collapsed = false, 
  setCollapsed, 
  isMobile = false,
  onNavigate 
}: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user } = useAuth()

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = location.pathname === item.href || 
      (item.href !== '/' && location.pathname.startsWith(item.href))
    
    const content = (
      <Link
        to={item.href}
        onClick={onNavigate}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
          'hover:bg-gray-100 dark:hover:bg-white/[0.03]',
          isActive 
            ? 'bg-primary/10 dark:bg-gradient-to-r dark:from-primary/15 dark:via-primary/10 dark:to-transparent' 
            : '',
          collapsed && 'justify-center px-3'
        )}
      >
        {/* Active indicator bar */}
        <div className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-300',
          isActive 
            ? 'h-6 bg-gradient-to-b from-accent to-primary shadow-[0_0_12px_rgba(161,124,255,0.5)]' 
            : 'h-0 bg-transparent'
        )} />
        
        {/* Icon container with background */}
        <div className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300',
          isActive 
            ? 'bg-primary/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
            : 'bg-gray-100 group-hover:bg-gray-200 dark:bg-white/[0.02] dark:group-hover:bg-white/[0.05]'
        )}>
          <item.icon className={cn(
            'h-[18px] w-[18px] transition-all duration-300',
            isActive 
              ? 'text-primary dark:text-accent drop-shadow-[0_0_8px_rgba(161,124,255,0.5)]' 
              : 'text-gray-500 group-hover:text-gray-700 dark:text-muted-foreground/70 dark:group-hover:text-white/80'
          )} />
        </div>
        
        {/* Label */}
        {!collapsed && (
          <span className={cn(
            'flex-1 text-sm font-medium transition-colors duration-300',
            isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 group-hover:text-gray-900 dark:text-muted-foreground dark:group-hover:text-white/90'
          )}>
            {item.name}
          </span>
        )}
        
        {/* Badge */}
        {!collapsed && item.badge && (
          <span className={cn(
            'px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors',
            isActive 
              ? 'bg-accent/20 text-accent' 
              : 'bg-white/5 text-muted-foreground group-hover:bg-white/10'
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    )

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="bg-surface-2 border-border">
            <p>{item.name}</p>
            {item.badge && <span className="ml-2 text-accent">({item.badge})</span>}
          </TooltipContent>
        </Tooltip>
      )
    }

    return content
  }

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-full transition-colors duration-300",
        "bg-white dark:bg-gradient-to-b dark:from-[#0a0520] dark:via-[#0d0825] dark:to-[#0a0520]",
        "border-r border-gray-200 dark:border-white/[0.04]",
        className
      )}>
        {/* Logo Area */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-gray-200 dark:border-white/[0.04]",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <Link 
            to="/" 
            className="flex items-center gap-3 group" 
            onClick={onNavigate}
          >
            {/* Logo Icon */}
            <div className={cn(
              "relative h-9 w-9 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-primary via-primary to-accent",
              "shadow-[0_0_20px_rgba(88,20,186,0.4)]",
              "transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(88,20,186,0.6)]"
            )}>
              <ShieldAlert className="h-5 w-5 text-white drop-shadow-sm" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/0 to-white/10" />
            </div>
            
            {/* Logo Text */}
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-900 to-primary dark:from-white dark:via-white dark:to-accent bg-clip-text text-transparent">
                  Clausync
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">
                  Contract Intel
                </span>
              </div>
            )}
          </Link>
          
          {/* Collapse Button */}
          {!isMobile && setCollapsed && !collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Main Navigation */}
        <ScrollArea className="flex-1 py-6">
          <div className="px-3 space-y-1">
            {/* Section Label */}
            {!collapsed && (
              <div className="flex items-center gap-2 px-3 mb-4">
                <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Navigation
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-white/5 to-transparent" />
              </div>
            )}
            
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>
          
          {/* Risk Pulse Section */}
          {!collapsed && (
            <div className="mt-8 px-3">
              <div className="flex items-center gap-2 px-3 mb-4">
                <Sparkles className="h-3 w-3 text-accent/60" />
                <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Risk Pulse
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-accent/10 to-transparent" />
              </div>
              
              <div className="space-y-1">
                {monitoredVendors.map((vendor) => {
                  const config = statusConfig[vendor.status]
                  return (
                    <Link
                      key={vendor.name}
                      to={vendor.href}
                      onClick={onNavigate}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all duration-200 group"
                    >
                      <span className="text-sm text-muted-foreground group-hover:text-white/90 transition-colors">
                        {vendor.name}
                      </span>
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full ring-2",
                        config.color,
                        config.glow,
                        config.ring,
                        vendor.status === 'critical' && 'animate-pulse'
                      )} />
                    </Link>
                  )
                })}
              </div>
              
              <Link 
                to="/monitors" 
                onClick={onNavigate}
                className="flex items-center gap-1.5 text-xs text-accent/80 hover:text-accent mt-4 px-3 transition-colors"
              >
                View all monitors 
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </ScrollArea>

        {/* User Profile Footer */}
        <div className={cn(
          "border-t border-white/[0.04]",
          "bg-gradient-to-t from-black/20 to-transparent",
          collapsed ? "p-2" : "p-3"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
                "hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-accent/50",
                collapsed && "justify-center"
              )}>
                <Avatar className="h-9 w-9 ring-2 ring-white/10 transition-all group-hover:ring-accent/30">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-medium">
                    JD
                  </AvatarFallback>
                </Avatar>
                
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        John Doe
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 truncate">
                        Pro Plan
                      </p>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground/40" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={collapsed ? "right" : "top"} 
              align={collapsed ? "start" : "center"}
              className="w-56 bg-[#0d0825] border-white/10"
            >
              <div className="p-2 border-b border-white/5">
                <p className="text-sm font-medium text-white">{user?.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                Team Members
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem 
                className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expand Button (when collapsed) */}
        {collapsed && !isMobile && setCollapsed && (
          <div className="p-2 border-t border-white/[0.04]">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(false)}
                  className="w-full h-9 rounded-lg text-muted-foreground/50 hover:text-white hover:bg-white/5"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-surface-2 border-border">
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
