import { http, HttpResponse } from 'msw'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// Mock data
const mockMonitor = {
  id: '123',
  userId: 'user-1',
  resourceId: 'resource-1',
  displayName: 'Test Monitor',
  personalizationEnabled: false,
  createdAt: new Date().toISOString(),
  resource: {
    id: 'resource-1',
    urlNormalized: 'https://example.com/terms',
    selector: 'main',
    currentHash: 'abc123',
    lastScrapedAt: new Date().toISOString(),
  },
}

const mockChange = {
  id: 'change-1',
  resourceId: 'resource-1',
  oldSnapshotId: 'snap-1',
  newSnapshotId: 'snap-2',
  diffJson: null,
  globalAiSummary: 'Terms were updated',
  globalRiskScore: 5,
  riskKeywords: ['liability', 'indemnification'],
  createdAt: new Date().toISOString(),
}

const mockAnalyticsDashboard = {
  totalMonitors: 5,
  activeMonitors: 5,
  totalChanges: 12,
  changesThisPeriod: 8,
  avgRiskScore: 4.5,
  highRiskCount: 2,
}

export const handlers = [
  // Monitors
  http.get(`${API_BASE}/monitors`, () => {
    return HttpResponse.json({ data: [mockMonitor] })
  }),

  http.get(`${API_BASE}/monitors/:id`, ({ params }) => {
    if (params.id === 'nonexistent') {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json({ data: { ...mockMonitor, id: params.id } })
  }),

  http.get(`${API_BASE}/monitors/:id/changes`, () => {
    return HttpResponse.json({ data: [mockChange] })
  }),

  // Changes
  http.get(`${API_BASE}/changes`, () => {
    return HttpResponse.json({ data: [mockChange] })
  }),

  http.get(`${API_BASE}/changes/:id`, ({ params }) => {
    return HttpResponse.json({ data: { ...mockChange, id: params.id } })
  }),

  // Analytics
  http.get(`${API_BASE}/analytics/dashboard`, () => {
    return HttpResponse.json({ data: mockAnalyticsDashboard })
  }),

  http.get(`${API_BASE}/analytics/changes`, () => {
    return HttpResponse.json({
      data: [
        { date: '2024-12-01', count: 5, avgRiskScore: 4.2 },
        { date: '2024-12-02', count: 8, avgRiskScore: 5.1 },
        { date: '2024-12-03', count: 3, avgRiskScore: 3.5 },
      ],
      period: '30d',
    })
  }),

  http.get(`${API_BASE}/analytics/top-resources`, () => {
    return HttpResponse.json({
      data: [
        { resourceId: 'r1', name: 'AWS Terms', changeCount: 12 },
        { resourceId: 'r2', name: 'Stripe Agreement', changeCount: 8 },
      ],
      period: '30d',
    })
  }),

  http.get(`${API_BASE}/analytics/risk-trends`, () => {
    return HttpResponse.json({
      data: [
        { date: '2024-12-01', avgRisk: 4.2, breakdown: { low: 5, medium: 3, high: 1, critical: 0 } },
        { date: '2024-12-02', avgRisk: 5.1, breakdown: { low: 3, medium: 4, high: 2, critical: 0 } },
      ],
      period: '30d',
    })
  }),

  // Users
  http.get(`${API_BASE}/users/me`, () => {
    return HttpResponse.json({
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      },
    })
  }),

  http.patch(`${API_BASE}/users/me`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      message: 'Profile updated',
      data: { id: 'user-1', ...body },
    })
  }),

  // Preferences
  http.get(`${API_BASE}/preferences/notifications`, () => {
    return HttpResponse.json({
      data: {
        id: 'pref-1',
        emailEnabled: true,
        digestFrequency: 'instant',
        riskThreshold: 5,
      },
    })
  }),

  http.patch(`${API_BASE}/preferences/notifications`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      message: 'Preferences updated',
      data: { id: 'pref-1', ...body },
    })
  }),

  // API Keys
  http.get(`${API_BASE}/api-keys`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'key-1',
          name: 'Production API',
          keyPrefix: 'csk_live_abc...',
          maskedKey: 'csk_live_abc************************',
          scopes: ['monitors:read', 'changes:read'],
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    })
  }),

  http.post(`${API_BASE}/api-keys`, async ({ request }) => {
    const body = await request.json() as { name: string; scopes?: string[] }
    return HttpResponse.json({
      message: 'API key created',
      apiKey: {
        id: 'key-new',
        name: body.name,
        key: 'csk_live_' + Math.random().toString(36).substring(2, 15),
        prefix: 'csk_live_' + Math.random().toString(36).substring(2, 6) + '...',
        scopes: body.scopes || ['monitors:read'],
        createdAt: new Date().toISOString(),
      },
      warning: 'Save this key securely. It will not be shown again.',
    }, { status: 201 })
  }),

  http.delete(`${API_BASE}/api-keys/:id`, () => {
    return HttpResponse.json({ message: 'API key revoked successfully' })
  }),

  http.get(`${API_BASE}/api-keys/scopes`, () => {
    return HttpResponse.json({
      scopes: [
        { scope: 'monitors:read', description: 'Read monitors' },
        { scope: 'monitors:write', description: 'Write monitors' },
        { scope: 'changes:read', description: 'Read changes' },
        { scope: 'analytics:read', description: 'Read analytics' },
      ],
      presets: [
        { name: 'read-only', scopes: ['monitors:read', 'changes:read'] },
        { name: 'full-access', scopes: ['monitors:read', 'monitors:write', 'changes:read', 'analytics:read'] },
      ],
    })
  }),
]
