/**
 * Unit Tests for Theme Store
 * 
 * Tests the Zustand theme store functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useThemeStore, type Theme } from '@/stores/theme-store'

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset theme store to default state
    useThemeStore.setState({ theme: 'dark', resolvedTheme: 'dark' })
    // Ensure document starts with dark class
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })

  afterEach(() => {
    // Clean up classes
    document.documentElement.classList.remove('dark', 'light')
  })

  it('should have dark as default theme', () => {
    const { theme, resolvedTheme } = useThemeStore.getState()
    
    expect(theme).toBe('dark')
    expect(resolvedTheme).toBe('dark')
  })

  it('should switch to light theme', () => {
    const { setTheme } = useThemeStore.getState()
    
    setTheme('light')
    
    const { theme, resolvedTheme } = useThemeStore.getState()
    expect(theme).toBe('light')
    expect(resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should switch between themes', () => {
    const { setTheme } = useThemeStore.getState()
    
    // Switch to light
    setTheme('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    
    // Switch back to dark
    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('should handle system theme preference', () => {
    const { setTheme } = useThemeStore.getState()
    
    setTheme('system')
    
    const { theme, resolvedTheme } = useThemeStore.getState()
    expect(theme).toBe('system')
    // resolvedTheme should be either 'light' or 'dark' based on system preference
    expect(['light', 'dark']).toContain(resolvedTheme)
  })
})
