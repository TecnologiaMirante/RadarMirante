import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './firebase'
import type {
  Opportunity,
  RadarPost,
  EditorialFeedback,
  RadarFilters,
  SocialPlatform,
} from '@/types/radar'
import type { RadarAccount } from '@/contexts/AccountContext'

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(filters: RadarFilters, account: RadarAccount = 'imirante'): Promise<RadarPost[]> {
  // Sem orderBy — o Firestore exclui documentos sem o campo indexado.
  // Toda filtragem e ordenação é feita no cliente para garantir que
  // posts antigos (sem publishedAt indexado) sejam incluídos.
  const constraints = []

  if (filters.platform !== 'all') {
    constraints.push(where('platform', '==', filters.platform as SocialPlatform))
  }

  // Para imiranteesporte filtra pelo campo account.
  // Para imirante não filtra (inclui posts sem campo account = dados históricos).
  if (account === 'imiranteesporte') {
    constraints.push(where('account', '==', 'imiranteesporte'))
  }

  const q = query(collection(db, 'posts'), ...constraints)
  const snapshot = await getDocs(q)

  let items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RadarPost))

  const cutoff = TIME_CUTOFFS[filters.time]
  if (cutoff !== null && cutoff !== undefined) {
    const since = Date.now() - cutoff
    items = items.filter((p) => {
      const ts = p.publishedAt as unknown as Timestamp
      return ts?.toMillis ? ts.toMillis() >= since : true
    })
  }

  return sortPosts(items, filters.sort)
}

function sortPosts(items: RadarPost[], sort: RadarFilters['sort']): RadarPost[] {
  return [...items].sort((a, b) => {
    if (sort === 'score') return b.trendScore - a.trendScore
    if (sort === 'comments') return b.metrics.comments - a.metrics.comments
    const aTs = a.publishedAt as unknown as Timestamp | undefined
    const bTs = b.publishedAt as unknown as Timestamp | undefined
    const aMs = aTs?.toMillis?.() ?? 0
    const bMs = bTs?.toMillis?.() ?? 0
    return bMs - aMs
  })
}

// ─── Opportunities ────────────────────────────────────────────────────────────
// Estratégia de query: busca no Firestore usando apenas filtros simples
// (platform e orderBy createdAt DESC). Filtragem de tempo e ordenação por
// score/growth/comments são feitas no cliente — o volume é pequeno o
// suficiente para isso e evita a explosão de indexes compostos.

// 'all' → sem corte (null). Todos os outros são em ms.
const TIME_CUTOFFS: Record<string, number | null> = {
  now:  1  * 60 * 60 * 1000,
  '3h': 3  * 60 * 60 * 1000,
  '6h': 6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '2d':  2  * 24 * 60 * 60 * 1000,
  '3d':  3  * 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '15d': 15 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all:  null,
}

export async function getOpportunities(filters: RadarFilters): Promise<Opportunity[]> {
  // Sem orderBy — evita excluir documentos sem o campo indexado.
  const constraints = []

  if (filters.platform !== 'all') {
    constraints.push(where('platform', '==', filters.platform as SocialPlatform))
  }

  const q = query(collection(db, 'opportunities'), ...constraints)
  const snapshot = await getDocs(q)

  let items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity))

  const cutoff = TIME_CUTOFFS[filters.time]
  if (cutoff !== null && cutoff !== undefined) {
    const since = Date.now() - cutoff
    items = items.filter((o) => {
      const ts = o.createdAt as unknown as Timestamp
      return ts?.toMillis ? ts.toMillis() >= since : true
    })
  }

  items = sortOpportunities(items, filters.sort)

  return items
}

function sortOpportunities(
  items: Opportunity[],
  sort: RadarFilters['sort'],
): Opportunity[] {
  return [...items].sort((a, b) => {
    if (sort === 'score') return b.trendScore - a.trendScore
    if (sort === 'growth') return b.baselineComparison - a.baselineComparison
    if (sort === 'comments') return b.commentsAtAnalysis - a.commentsAtAnalysis
    const aTs = a.createdAt as unknown as Timestamp | undefined
    const bTs = b.createdAt as unknown as Timestamp | undefined
    const aMs = aTs?.toMillis?.() ?? 0
    const bMs = bTs?.toMillis?.() ?? 0
    return bMs - aMs
  })
}

export async function getPost(postId: string): Promise<RadarPost | null> {
  const ref = doc(db, 'posts', postId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as RadarPost
}

export async function getPostOpportunity(postId: string): Promise<Opportunity | null> {
  const q = query(
    collection(db, 'opportunities'),
    where('postId', '==', postId),
    limit(1),
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Opportunity
}

export async function getOpportunity(opportunityId: string): Promise<Opportunity | null> {
  const ref = doc(db, 'opportunities', opportunityId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as Opportunity
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getPostComments(postId: string, maxItems = 50): Promise<import('@/types/radar').RadarComment[]> {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('publishedAt', 'desc'),
    limit(maxItems),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import('@/types/radar').RadarComment)
  )
}

export async function getRecentCommentTexts(sinceMs: number, maxItems = 2000): Promise<string[]> {
  const filterAndMap = (docs: import('firebase/firestore').QueryDocumentSnapshot[]) =>
    docs
      .filter((d) => {
        const ts = d.data().publishedAt as { toMillis?: () => number } | undefined
        return ts?.toMillis ? ts.toMillis() >= sinceMs : false
      })
      .map((d) => (d.data().text as string) ?? '')
      .filter(Boolean)

  try {
    // Query ordenada: traz os mais recentes primeiro (requer índice COLLECTION_GROUP)
    const snap = await getDocs(query(
      collectionGroup(db, 'comments'),
      orderBy('publishedAt', 'desc'),
      limit(maxItems),
    ))
    return filterAndMap(snap.docs)
  } catch {
    // Fallback enquanto o índice ainda está construindo
    const snap = await getDocs(query(
      collectionGroup(db, 'comments'),
      limit(maxItems),
    ))
    return filterAndMap(snap.docs)
  }
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function getPostSnapshots(postId: string, maxItems = 48): Promise<import('@/types/radar').RadarSnapshot[]> {
  const q = query(
    collection(db, 'posts', postId, 'snapshots'),
    orderBy('timestamp', 'desc'),
    limit(maxItems),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as import('@/types/radar').RadarSnapshot))
    .reverse()
}

// ─── Trigger manual de análise (via Firestore job queue) ─────────────────────
// Escreve um documento em analysisRequests e aguarda a função backend processar.
// Evita chamadas HTTP diretas ao Cloud Run (CORS + IAM org policy).

export function triggerPostAnalysis(postId: string): Promise<{ opportunityId: string }> {
  const uid = auth.currentUser?.uid
  if (!uid) return Promise.reject(new Error('Não autenticado'))

  return new Promise(async (resolve, reject) => {
    let ref: import('firebase/firestore').DocumentReference

    try {
      ref = await addDoc(collection(db, 'analysisRequests'), {
        postId,
        requestedBy: uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      reject(err)
      return
    }

    const timeout = setTimeout(() => {
      unsub()
      reject(new Error('Tempo esgotado aguardando análise (2 min)'))
    }, 2 * 60 * 1000)

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (!data) return
      if (data.status === 'completed' && data.opportunityId) {
        clearTimeout(timeout)
        unsub()
        resolve({ opportunityId: data.opportunityId as string })
      }
      if (data.status === 'failed') {
        clearTimeout(timeout)
        unsub()
        reject(new Error(data.error as string ?? 'Análise falhou'))
      }
    })
  })
}

// ─── Editorial Feedback ───────────────────────────────────────────────────────

export async function submitFeedback(
  opportunityId: string,
  userId: string,
  useful: boolean,
  reason?: string,
): Promise<string> {
  const feedback: Omit<EditorialFeedback, 'id'> = {
    opportunityId,
    userId,
    useful,
    ...(reason ? { reason } : {}),
    createdAt: serverTimestamp() as EditorialFeedback['createdAt'],
  }
  const ref = await addDoc(collection(db, 'editorialFeedback'), feedback)
  return ref.id
}
