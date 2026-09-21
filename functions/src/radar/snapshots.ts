import * as admin from 'firebase-admin'
import type { RadarSnapshot, RadarComment } from '../types/radar'

// ─── Snapshots de métricas ────────────────────────────────────────────────────
// Registram a evolução do engajamento ao longo do tempo.
// Permitem calcular velocidade e aceleração de comentários.

const Timestamp = admin.firestore.Timestamp

export async function createSnapshot(
  db: admin.firestore.Firestore,
  postId: string,
  comments: RadarComment[],
  currentMetrics: { comments: number; likes: number; shares: number; views?: number },
): Promise<RadarSnapshot> {
  const now = new Date()
  const nowMs = now.getTime()

  const window15m = nowMs - 15 * 60 * 1000
  const window60m = nowMs - 60 * 60 * 1000

  const comments15m = comments.filter(
    (c) => c.publishedAt.toMillis() >= window15m,
  )
  const comments60m = comments.filter(
    (c) => c.publishedAt.toMillis() >= window60m,
  )

  const uniqueAuthors15m = new Set(comments15m.map((c) => c.authorHash)).size
  const uniqueAuthors60m = new Set(comments60m.map((c) => c.authorHash)).size

  // Velocidade: comentários por minuto (janela de 15min)
  const commentVelocity = comments15m.length / 15

  // Aceleração: diferença de velocidade em relação ao snapshot anterior
  const previousSnapshot = await getLastSnapshot(db, postId)
  const previousVelocity = previousSnapshot?.commentVelocity ?? 0
  const acceleration = commentVelocity - previousVelocity

  const snapshot: Omit<RadarSnapshot, 'id'> = {
    postId,
    timestamp: Timestamp.fromDate(now),
    comments: currentMetrics.comments,
    likes: currentMetrics.likes,
    shares: currentMetrics.shares,
    ...(currentMetrics.views !== undefined ? { views: currentMetrics.views } : {}),
    comments15m: comments15m.length,
    comments60m: comments60m.length,
    uniqueAuthors15m,
    uniqueAuthors60m,
    commentVelocity,
    acceleration,
  }

  const ref = await db
    .collection('posts')
    .doc(postId)
    .collection('snapshots')
    .add(snapshot)

  return { id: ref.id, ...snapshot }
}

export async function getLastSnapshot(
  db: admin.firestore.Firestore,
  postId: string,
): Promise<RadarSnapshot | null> {
  const snap = await db
    .collection('posts')
    .doc(postId)
    .collection('snapshots')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get()

  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as RadarSnapshot
}

export async function getSnapshotHistory(
  db: admin.firestore.Firestore,
  postId: string,
  limitCount = 24,
): Promise<RadarSnapshot[]> {
  const snap = await db
    .collection('posts')
    .doc(postId)
    .collection('snapshots')
    .orderBy('timestamp', 'desc')
    .limit(limitCount)
    .get()

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RadarSnapshot)).reverse()
}
