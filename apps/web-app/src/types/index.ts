// =============================================================================
// User Types
// =============================================================================

export interface User {
  id: string
  email: string
  name: string | null
  role: 'viewer' | 'editor' | 'admin' | 'super_admin'
  organizationId: string
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Monitor Types
// =============================================================================

export interface Monitor {
  id: string
  userId: string
  resourceId: string
  displayName: string | null
  createdAt: string
  resource?: {
    id: string
    urlNormalized: string
    selector: string
    currentHash: string | null
    lastScrapedAt: string | null
  }
}

export interface CreateMonitorPayload {
  url: string
  name?: string
  selector?: string
  frequency?: string
}

// =============================================================================
// Change Types
// =============================================================================

export interface ChangeItem {
  section: string
  change_type: 'added' | 'removed' | 'modified'
  description: string
  old_text?: string
  new_text?: string
  impact: string
  risk_delta?: 'increased' | 'decreased' | 'neutral'
}

export interface KeySection {
  section: string
  description: string
  risk_indicator: 'low' | 'medium' | 'high'
  concern?: string
}

export interface DiffJson {
  changes: ChangeItem[]
  key_sections: KeySection[]
  notable_clauses: string[]
  is_initial_baseline: boolean
  risk_rationale: string
  red_flags: string[]
  positive_indicators: string[]
  document_type: string
  recommendation: string
}

export interface ChangeEvent {
  id: string
  resourceId: string
  oldSnapshotId: string | null
  newSnapshotId: string | null
  diffJson: DiffJson | null
  globalAiSummary: string | null
  globalRiskScore: number | null
  riskKeywords: string[]
  createdAt: string
  displayName?: string | null
  resource?: {
    urlNormalized: string
    selector: string
  }
}

// Extended type for change detail API response
export interface ChangeEventDetail extends ChangeEvent {
  resource: {
    id: string
    urlNormalized: string
    selector: string
    contentHash: string | null
    createdAt: string
    updatedAt: string
  }
  oldSnapshot: {
    id: string
    gcsUri: string
    contentHash: string
    createdAt: string
  } | null
  newSnapshot: {
    id: string
    gcsUri: string
    contentHash: string
    createdAt: string
  } | null
  personalizedAnalysis: string | null
  riskLevel: string | null
}

export type RiskLevel = 'low' | 'medium' | 'high'

export function getRiskLevel(score: number | null): RiskLevel {
  if (!score || score <= 3) return 'low'
  if (score <= 6) return 'medium'
  return 'high'
}

// =============================================================================
// API Key Types
// =============================================================================

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface CreateApiKeyPayload {
  name: string
  scopes: string[]
  expiresAt?: string
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey
  plainKey: string
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface AnalyticsDashboard {
  totalMonitors: number
  activeMonitors: number
  totalChanges: number
  changesThisPeriod: number
  avgRiskScore: number
  highRiskCount: number
}

export interface ChangeAnalytics {
  date: string
  count: number
  avgRisk: number
}

export interface TopResource {
  resourceId: string
  name: string
  changeCount: number
}

export type AnalyticsPeriod = '7d' | '30d' | '90d'

// =============================================================================
// Document Types (Phase 3)
// =============================================================================

export interface Document {
  id: string
  userId: string
  filename: string
  mimeType: string
  fileSize: number
  status: 'pending' | 'processing' | 'ready' | 'failed'
  chunkCount: number | null
  createdAt: string
  updatedAt: string
}

export interface UploadDocumentPayload {
  file: File
}

// =============================================================================
// Snapshot Types (Phase 3)
// =============================================================================

export interface Snapshot {
  id: string
  resourceId: string
  gcsUri: string
  contentHash: string
  contentLength: number | null
  scrapedAt: string
  createdAt: string
}

export interface SnapshotContent {
  downloadUrl: string
  expiresIn: string
  contentType: string
  snapshotId: string
  scrapedAt: string
}

// =============================================================================
// Report Types (Phase 3)
// =============================================================================

export interface Report {
  id: string
  userId: string
  organizationId: string
  type: 'risk_summary' | 'change_history' | 'compliance'
  format: 'pdf' | 'csv'
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  gcsUri: string | null
  expiresAt: string | null
  createdAt: string
}

export interface GenerateReportPayload {
  type: 'risk_summary' | 'change_history' | 'compliance'
  format: 'pdf' | 'csv'
  period: '7d' | '30d' | '90d'
  resourceIds?: string[]
}

export interface ReportDownload {
  downloadUrl: string
  expiresIn: string
  filename: string
}

// =============================================================================
// API Response Types
// =============================================================================

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

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}

