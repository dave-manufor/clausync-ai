/**
 * Theme Toggle Component
 * 
 * Toggle between light and dark themes with localStorage persistence.
 */
import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores'

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore()

  // Apply theme class to document
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  // Initialize from system preference on first load
  useEffect(() => {
    const stored = localStorage.getItem('ui-storage')
    if (!stored) {
      // No stored preference, use system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(systemPrefersDark ? 'dark' : 'light')
    }
  }, [setTheme])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
