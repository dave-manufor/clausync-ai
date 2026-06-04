import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { apiClient } from './api-client'
import type { ChangeEventDetail, Monitor, ChangeEvent, User, ApiKey, AnalyticsDashboard, ChangeAnalytics, SnapshotContent } from '@/types'

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
    placeholderData: keepPreviousData, // Show cached data during refetch
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
    placeholderData: keepPreviousData, // Show cached data during refetch
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
    placeholderData: keepPreviousData, // Show cached data during refetch
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
    placeholderData: keepPreviousData, // Show cached data during refetch
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
    placeholderData: keepPreviousData, // Show cached data during refetch
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

// =============================================================================
// Document Hooks (Phase 3)
// =============================================================================

import type { Document, Snapshot, Report, GenerateReportPayload, ReportDownload } from '@/types'

export function useDocuments(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Document[]; pagination: unknown }>('/documents', { params })
      return data
    },
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Document>(`/documents/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<{ document: Document }>('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// =============================================================================
// Snapshot Hooks (Phase 3)
// =============================================================================

export function useSnapshots(monitorId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['monitors', monitorId, 'snapshots', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Snapshot[]; pagination: unknown }>(
        `/monitors/${monitorId}/snapshots`,
        { params }
      )
      return data
    },
    enabled: !!monitorId,
  })
}

export function useSnapshot(monitorId: string, snapshotId: string) {
  return useQuery({
    queryKey: ['monitors', monitorId, 'snapshots', snapshotId],
    queryFn: async () => {
      const { data } = await apiClient.get<Snapshot>(`/monitors/${monitorId}/snapshots/${snapshotId}`)
      return data
    },
    enabled: !!monitorId && !!snapshotId,
  })
}

export function useSnapshotContent(monitorId: string, snapshotId: string) {
  return useQuery({
    queryKey: ['monitors', monitorId, 'snapshots', snapshotId, 'content'],
    queryFn: async () => {
      const { data } = await apiClient.get<SnapshotContent>(`/monitors/${monitorId}/snapshots/${snapshotId}/content`)
      return data
    },
    enabled: !!monitorId && !!snapshotId,
  })
}

// =============================================================================
// Monitor Control Hooks (Phase 3)
// =============================================================================

export function usePauseMonitor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<{ data: Monitor }>(`/monitors/${id}/pause`)
      return data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors })
      queryClient.invalidateQueries({ queryKey: queryKeys.monitor(id) })
    },
  })
}

export function useResumeMonitor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<{ data: Monitor }>(`/monitors/${id}/resume`)
      return data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors })
      queryClient.invalidateQueries({ queryKey: queryKeys.monitor(id) })
    },
  })
}

// =============================================================================
// Report Hooks (Phase 3)
// =============================================================================

export function useReports(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Report[]; meta: { total: number } }>('/reports', { params })
      return data
    },
    refetchInterval: 5000, // Poll every 5 seconds to update report status
    placeholderData: keepPreviousData,
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['reports', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Report }>(`/reports/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useGenerateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GenerateReportPayload) => {
      const { data } = await apiClient.post<{ reportId: string; status: string }>('/reports', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export function useReportDownload(id: string) {
  return useQuery({
    queryKey: ['reports', id, 'download'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReportDownload>(`/reports/${id}/download`)
      return data
    },
    enabled: false, // Only fetch on demand
  })
}

export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reports/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
