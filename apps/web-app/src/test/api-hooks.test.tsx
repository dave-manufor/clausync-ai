/**
 * Unit Tests for API Hooks
 * 
 * Tests the React Query hooks with MSW mock handlers.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { 
  useMonitors, 
  useMonitor, 
  useChanges, 
  useApiKeys,
  useCurrentUser,
} from '@/lib/api-hooks'

// Create a wrapper with QueryClient for testing hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('API Hooks', () => {
  describe('useMonitors', () => {
    it('should fetch monitors list', async () => {
      const { result } = renderHook(() => useMonitors(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      // Wait for data
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Should have monitors data
      expect(result.current.data).toBeDefined()
      expect(Array.isArray(result.current.data)).toBe(true)
    })
  })

  describe('useMonitor', () => {
    it('should fetch a single monitor by ID', async () => {
      const { result } = renderHook(() => useMonitor('monitor-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toBeDefined()
    })

    it('should not fetch if ID is empty', async () => {
      const { result } = renderHook(() => useMonitor(''), {
        wrapper: createWrapper(),
      })

      // Should not be loading (query disabled)
      expect(result.current.fetchStatus).toBe('idle')
    })
  })

  describe('useChanges', () => {
    it('should fetch changes list', async () => {
      const { result } = renderHook(() => useChanges(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toBeDefined()
      expect(Array.isArray(result.current.data)).toBe(true)
    })

    it('should accept severity filter', async () => {
      const { result } = renderHook(() => useChanges({ severity: 'high' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toBeDefined()
    })
  })

  describe('useApiKeys', () => {
    it('should fetch API keys list', async () => {
      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toBeDefined()
    })
  })

  describe('useCurrentUser', () => {
    it('should fetch current user profile', async () => {
      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toBeDefined()
    })
  })
})
