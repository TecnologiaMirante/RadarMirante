import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type { Invite, AuditLogEntry, AuditAction, SystemHealthEntry } from '@/types/admin'
import type { UserRole } from '@/types/user'

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function getInvites(): Promise<Invite[]> {
  const snap = await getDocs(
    query(collection(db, 'invites'), orderBy('createdAt', 'desc'), limit(100)),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Invite)
}

export async function createInvite(params: {
  email: string
  role: UserRole
  accounts: string[]
}): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Não autenticado')
  const email = params.email.toLowerCase().trim()
  const existing = await getDocs(
    query(collection(db, 'invites'), where('email', '==', email), where('status', '==', 'pending')),
  )
  if (!existing.empty) throw new Error('Já existe um convite pendente para este e-mail')
  await addDoc(collection(db, 'invites'), {
    email,
    role: params.role,
    accounts: params.accounts,
    createdBy: user.uid,
    createdByEmail: user.email ?? '',
    createdAt: serverTimestamp(),
    status: 'pending',
  })
  await writeAuditLog('invite_created', { details: { email, role: params.role } })
}

export async function deleteInvite(id: string): Promise<void> {
  const ref = doc(db, 'invites', id)
  const snap = await getDoc(ref)
  const email = snap.data()?.email
  await deleteDoc(ref)
  await writeAuditLog('invite_deleted', { details: { email } })
}

// ─── Disable / Enable user ────────────────────────────────────────────────────

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Não autenticado')
  await updateDoc(doc(db, 'users', uid), {
    disabled,
    updatedBy: user.uid,
    updatedByEmail: user.email ?? '',
    updatedAt: serverTimestamp(),
  })
}

// ─── setUserRole / setUserAccounts (com audit metadata) ───────────────────────

export async function setUserRoleWithAudit(uid: string, role: UserRole): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Não autenticado')
  await updateDoc(doc(db, 'users', uid), {
    role,
    isAdmin: role !== 'user',
    updatedBy: user.uid,
    updatedByEmail: user.email ?? '',
    updatedAt: serverTimestamp(),
  })
}

export async function setUserAccountsWithAudit(uid: string, accounts: string[]): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Não autenticado')
  await updateDoc(doc(db, 'users', uid), {
    accounts,
    updatedBy: user.uid,
    updatedByEmail: user.email ?? '',
    updatedAt: serverTimestamp(),
  })
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function writeAuditLog(
  action: AuditAction,
  opts: { targetUid?: string; targetEmail?: string; details?: Record<string, unknown> } = {},
): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  try {
    await addDoc(collection(db, 'activityLog'), {
      action,
      performedBy: user.uid,
      performedByEmail: user.email ?? '',
      ...opts,
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('[audit]', err)
  }
}

export async function getAuditLog(maxEntries = 100): Promise<AuditLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'activityLog'), orderBy('createdAt', 'desc'), limit(maxEntries)),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLogEntry)
}

// ─── System Health ────────────────────────────────────────────────────────────

const HEALTH_LABELS: Record<string, string> = {
  monitorPosts:      'Monitoramento de posts',
  collectInstagram:  'Coleta Instagram',
  syncInsights:      'Sync de Insights',
}

export async function getSystemHealth(): Promise<SystemHealthEntry[]> {
  const ids = ['monitorPosts', 'collectInstagram', 'syncInsights']
  const entries: SystemHealthEntry[] = []
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'systemHealth', id))
    if (snap.exists()) {
      entries.push({ id, label: HEALTH_LABELS[id] ?? id, ...snap.data() } as SystemHealthEntry)
    } else {
      entries.push({
        id, label: HEALTH_LABELS[id] ?? id,
        lastStatus: 'never', consecutiveErrors: 0, runCount: 0,
      })
    }
  }
  return entries
}
