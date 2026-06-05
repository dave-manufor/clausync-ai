import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { Toaster } from '@clausync/ui'
import { toast } from 'sonner'
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
import { SnapshotViewerPage } from '@/pages/monitors/SnapshotViewerPage'

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

// Documents (Phase 3)
import { DocumentsPage } from '@/features/documents/DocumentsPage'

// Reports (Phase 3)
import { ReportsPage } from '@/features/reports/ReportsPage'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Ignore 404s for global toasts to prevent noise
      const status = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response?.status 
        : null;
      if (status !== 404) {
        toast.error(`Error: ${error instanceof Error ? error.message : 'Something went wrong'}`)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Action failed: ${error instanceof Error ? error.message : 'Something went wrong'}`)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx) - these won't resolve with retries
        if (error instanceof Error && 'response' in error) {
          const status = (error as { response?: { status?: number } }).response?.status
          if (status && status >= 400 && status < 500) {
            return false // No retry on 400, 401, 403, 404, etc.
          }
        }
        // Retry up to 2 times on server errors (5xx) or network errors
        return failureCount < 2
      },
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
              <Route path="/monitors/:id/snapshots/:sid" element={<SnapshotViewerPage />} />

              {/* Changes */}
              <Route path="/changes" element={<ChangesListPage />} />
              <Route path="/changes/:id" element={<ChangeDetailPage />} />

              {/* Analytics */}
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Documents (Phase 3) */}
              <Route path="/documents" element={<DocumentsPage />} />

              {/* Reports (Phase 3) */}
              <Route path="/reports" element={<ReportsPage />} />

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
