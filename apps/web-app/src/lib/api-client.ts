import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { auth } from './firebase'

// API base URL - default to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Token storage key
const AUTH_TOKEN_KEY = 'clausync_auth_token'

// Get stored token
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

// Set token
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

// Clear token
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

// Request interceptor - add auth token (get fresh token if possible)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Try to get a fresh token from Firebase if user is logged in
    const currentUser = auth.currentUser
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken()
        setAuthToken(token)
        if (config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (err) {
        console.error('Failed to get fresh token:', err)
        // Fall back to stored token
        const storedToken = getAuthToken()
        if (storedToken && config.headers) {
          config.headers.Authorization = `Bearer ${storedToken}`
        }
      }
    } else {
      // No Firebase user, try stored token
      const token = getAuthToken()
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
// NOTE: Do NOT redirect on 401 - let the ProtectedRoute component handle auth state
// This prevents redirect loops when Firebase auth and API auth are out of sync
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Log the 401 but don't redirect - the auth state will be handled by useAuth
      console.warn('API returned 401 - auth may be required')
      // Clear the stored token since it's likely invalid
      clearAuthToken()
      // The ProtectedRoute will handle redirecting to login when
      // Firebase auth state changes to unauthenticated
    }
    return Promise.reject(error)
  }
)

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Error type
export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}

export function isApiError(error: unknown): error is AxiosError<ApiError> {
  return axios.isAxiosError(error)
}
