import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Clausync/)
  })

  test('should show login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})
