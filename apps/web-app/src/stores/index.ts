import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isEmailVerified: boolean
  setUser: (user: AuthUser) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isEmailVerified: false,
      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: true,
          isEmailVerified: user.emailVerified,
        })
      },
      clearUser: () => {
        set({ 
          user: null, 
          isAuthenticated: false,
          isEmailVerified: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        isEmailVerified: state.isEmailVerified,
      }),
    }
  )
)

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
)
