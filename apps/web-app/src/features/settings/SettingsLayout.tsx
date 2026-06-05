import { Outlet, Link, useLocation } from 'react-router-dom'
import { User, Shield, Key, Bell } from 'lucide-react'
import { cn } from '@clausync/ui'

const settingsTabs = [
  { name: 'Profile', href: '/settings', icon: User },
  { name: 'Security', href: '/settings/security', icon: Shield },
  { name: 'API Keys', href: '/settings/api-keys', icon: Key },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell },
]

export function SettingsLayout() {
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="space-y-1">
            {settingsTabs.map((tab) => {
              const isActive = location.pathname === tab.href
              return (
                <Link
                  key={tab.name}
                  to={tab.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary/10 text-accent font-medium'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-white'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
