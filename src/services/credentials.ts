import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type { Credential } from '@/types/credentials'

export async function getCredentials(): Promise<Credential[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []

  // Dois queries: visíveis para todos + visíveis para este UID
  const [allSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'credentials'), where('visibleTo', '==', 'all'))),
    getDocs(query(collection(db, 'credentials'), where('visibleTo', 'array-contains', uid))),
  ])

  const map = new Map<string, Credential>()
  for (const d of [...allSnap.docs, ...userSnap.docs]) {
    if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() } as Credential)
  }

  return [...map.values()].sort((a, b) => {
    const aMs = (a.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0
    const bMs = (b.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0
    return aMs - bMs
  })
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function createCredential(
  data: Omit<Credential, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Não autenticado')

  // Garante que o criador sempre está na lista quando visibilidade é "Específicos"
  const visibleTo = Array.isArray(data.visibleTo) && !data.visibleTo.includes(uid)
    ? [...data.visibleTo, uid]
    : data.visibleTo

  const ref = await addDoc(collection(db, 'credentials'), {
    ...stripUndefined({ ...data, visibleTo } as Record<string, unknown>),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCredential(
  id: string,
  data: Partial<Omit<Credential, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  await updateDoc(doc(db, 'credentials', id), {
    ...stripUndefined(data as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCredential(id: string): Promise<void> {
  await deleteDoc(doc(db, 'credentials', id))
}
