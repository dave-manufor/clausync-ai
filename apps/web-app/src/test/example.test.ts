/**
 * Example test file demonstrating testing patterns
 * 
 * This file serves as a reference for how to write tests in this project.
 */

import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true)
  })

  it('should support async tests', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })

  it('should have jest-dom matchers available', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello'
    document.body.appendChild(div)
    
    expect(div).toBeInTheDocument()
    expect(div).toHaveTextContent('Hello')
    
    document.body.removeChild(div)
  })
})
