import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { useThemeStore } from '@/stores/theme-store'

// Layouts
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'

// Auth Components
import { ProtectedRoute, AuthRedirect } from '@/components/auth/ProtectedRoute'

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'

// Dashboard
import { DashboardPage } from '@/pages/dashboard/DashboardPage'

// Monitors
import { MonitorsListPage } from '@/pages/monitors/MonitorsListPage'
import { MonitorDetailPage } from '@/pages/monitors/MonitorDetailPage'
import { AddMonitorPage } from '@/pages/monitors/AddMonitorPage'

// Changes
import { ChangesListPage } from '@/pages/changes/ChangesListPage'
import { ChangeDetailPage } from '@/pages/changes/ChangeDetailPage'

// Settings (Phase 2)
import {
  SettingsLayout,
  ProfileSettingsPage,
  SecuritySettingsPage,
  ApiKeysSettingsPage,
  NotificationsSettingsPage,
} from '@/features/settings'

// Analytics (Phase 2)
import { AnalyticsPage } from '@/features/analytics'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  const { theme, setTheme } = useThemeStore()
  
  // Initialize theme on mount
  useEffect(() => {
    // Re-apply theme to ensure DOM is in sync with store
    setTheme(theme)
  }, [])
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes - Redirect if already authenticated */}
          <Route element={<AuthRedirect />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>
          </Route>

          {/* Email Verification - Standalone route */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected Routes - Require auth + email verification */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Dashboard */}
              <Route path="/" element={<DashboardPage />} />

              {/* Monitors */}
              <Route path="/monitors" element={<MonitorsListPage />} />
              <Route path="/monitors/new" element={<AddMonitorPage />} />
              <Route path="/monitors/:id" element={<MonitorDetailPage />} />

              {/* Changes */}
              <Route path="/changes" element={<ChangesListPage />} />
              <Route path="/changes/:id" element={<ChangeDetailPage />} />

              {/* Analytics */}
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Settings */}
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<ProfileSettingsPage />} />
                <Route path="security" element={<SecuritySettingsPage />} />
                <Route path="api-keys" element={<ApiKeysSettingsPage />} />
                <Route path="notifications" element={<NotificationsSettingsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
