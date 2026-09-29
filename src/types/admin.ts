import type { Timestamp } from 'firebase/firestore'
import type { UserRole } from './user'

export interface Invite {
  id: string
  email: string
  role: UserRole
  accounts: string[]
  createdBy: string
  createdByEmail: string
  createdAt: Timestamp
  status: 'pending' | 'accepted'
  acceptedAt?: Timestamp
  acceptedBy?: string
}

export type AuditAction =
  | 'user_created'
  | 'user_disabled'
  | 'user_enabled'
  | 'role_changed'
  | 'accounts_changed'
  | 'invite_created'
  | 'invite_deleted'
  | 'credential_accessed'
  | 'credential_created'
  | 'credential_deleted'
  | 'analysis_triggered'

export interface AuditLogEntry {
  id: string
  action: AuditAction
  performedBy: string
  performedByEmail: string
  targetUid?: string
  targetEmail?: string
  details?: Record<string, unknown>
  createdAt: Timestamp
}

export type SystemHealthStatus = 'success' | 'error' | 'never'

export interface SystemHealthEntry {
  id: string
  label: string
  lastRun?: Timestamp
  lastStatus: SystemHealthStatus
  lastError?: string
  lastDurationMs?: number
  consecutiveErrors: number
  runCount: number
}
