import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './api-client'
import type { ChangeEventDetail, Monitor, ChangeEvent, User, ApiKey, AnalyticsDashboard, ChangeAnalytics } from '@/types'

// =============================================================================
// Query Keys
// =============================================================================

// =============================================================================
// Query Keys
// =============================================================================

export const queryKeys = {
  user: ['user'] as const,
  monitors: ['monitors'] as const,
  monitor: (id: string) => ['monitors', id] as const,
  changes: ['changes'] as const,
  change: (id: string) => ['changes', id] as const,
  apiKeys: ['apiKeys'] as const,
  analytics: {
    dashboard: (period: string) => ['analytics', 'dashboard', period] as const,
    changes: (period: string) => ['analytics', 'changes', period] as const,
    topResources: (period: string) => ['analytics', 'top-resources', period] as const,
  },
}

// =============================================================================
// User Hooks
// =============================================================================

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const { data } = await apiClient.get<User>('/users/me')
      return data
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: { name?: string }) => {
      const { data } = await apiClient.patch<User>('/users/me', updates)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      await apiClient.post('/users/me/password', payload)
    },
  })
}

// =============================================================================
// Monitor Hooks
// =============================================================================

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Monitor[]; pagination: unknown }>('/monitors')
      return data.data // Extract array from paginated response
    },
  })
}

export function useMonitor(id: string) {
  return useQuery({
    queryKey: queryKeys.monitor(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Monitor>(`/monitors/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateMonitor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { url: string; name?: string; selector?: string; frequency?: string }) => {
      const { data } = await apiClient.post<Monitor>('/monitors', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors })
    },
  })
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/monitors/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors })
    },
  })
}

// =============================================================================
// Change Hooks
// =============================================================================

export function useChanges(params?: { limit?: number; severity?: string }) {
  return useQuery({
    queryKey: [...queryKeys.changes, params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ChangeEvent[]; pagination: unknown }>('/changes', { params })
      return data.data // Extract array from paginated response
    },
  })
}

export function useChange(id: string) {
  return useQuery({
    queryKey: queryKeys.change(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ChangeEventDetail>(`/changes/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useMonitorChanges(monitorId: string, params?: { limit?: number }) {
  return useQuery({
    queryKey: ['monitors', monitorId, 'changes', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ChangeEvent[]; pagination: unknown }>(
        `/monitors/${monitorId}/changes`,
        { params }
      )
      return data.data
    },
    enabled: !!monitorId,
  })
}

// =============================================================================
// API Key Hooks
// =============================================================================

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiKey[]>('/api-keys')
      return data
    },
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; scopes: string[]; expiresAt?: string }) => {
      const { data } = await apiClient.post<{ apiKey: ApiKey; plainKey: string }>('/api-keys', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys })
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api-keys/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys })
    },
  })
}

// =============================================================================
// Analytics Hooks
// =============================================================================

export function useAnalyticsDashboard(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(period),
    queryFn: async () => {
      const { data } = await apiClient.get<AnalyticsDashboard>('/analytics/dashboard', {
        params: { period },
      })
      return data
    },
  })
}

export function useChangeAnalytics(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: queryKeys.analytics.changes(period),
    queryFn: async () => {
      const { data } = await apiClient.get<ChangeAnalytics[]>('/analytics/changes', {
        params: { period },
      })
      return data
    },
  })
}

export function useTopResources(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: queryKeys.analytics.topResources(period),
    queryFn: async () => {
      const { data } = await apiClient.get<{ resourceId: string; name: string; changeCount: number }[]>(
        '/analytics/top-resources',
        { params: { period } }
      )
      return data
    },
  })
}

// =============================================================================
// Notification Preferences Hooks
// =============================================================================

export interface NotificationPreferences {
  id: string
  emailEnabled: boolean
  digestFrequency: 'instant' | 'daily' | 'weekly'
  riskThreshold: number
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['preferences', 'notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<NotificationPreferences>('/preferences/notifications')
      return data
    },
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<Omit<NotificationPreferences, 'id'>>) => {
      const { data } = await apiClient.patch<NotificationPreferences>('/preferences/notifications', updates)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', 'notifications'] })
    },
  })
}

