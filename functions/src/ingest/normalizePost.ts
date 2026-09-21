import * as admin from 'firebase-admin'
import { createHash } from 'crypto'
import type { RawPost } from '../connectors/base'
import type { RadarPost, SocialPlatform } from '../types/radar'

const FieldValue = admin.firestore.FieldValue
const Timestamp = admin.firestore.Timestamp

// ─── Normalização de Post ─────────────────────────────────────────────────────
// Converte dados brutos do connector para o schema do Firestore.
// Verifica duplicatas por externalId + platform antes de salvar.

export async function normalizeAndSavePost(
  db: admin.firestore.Firestore,
  platform: SocialPlatform,
  raw: RawPost,
): Promise<{ postId: string; isNew: boolean }> {
  const postsRef = db.collection('posts')

  // Verifica se já existe (idempotência)
  const existing = await postsRef
    .where('externalId', '==', raw.externalId)
    .where('platform', '==', platform)
    .limit(1)
    .get()

  if (!existing.empty) {
    const doc = existing.docs[0]
    // Atualiza apenas métricas e updatedAt
    await doc.ref.update({
      metrics: raw.metrics,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { postId: doc.id, isNew: false }
  }

  // Cria novo post
  const now = FieldValue.serverTimestamp()
  const newPost: Omit<RadarPost, 'id'> = {
    externalId: raw.externalId,
    platform,
    url: raw.url,
    ...(raw.title ? { title: raw.title } : {}),
    text: raw.text,
    ...(raw.contentType ? { contentType: raw.contentType } : {}),
    publishedAt: Timestamp.fromDate(raw.publishedAt),
    collectedAt: Timestamp.now(),
    metrics: raw.metrics,
    status: 'monitoring',
    trendScore: 0,
    trendConfidence: 0,
    createdAt: now as unknown as admin.firestore.Timestamp,
    updatedAt: now as unknown as admin.firestore.Timestamp,
  }

  const ref = await postsRef.add(newPost)
  return { postId: ref.id, isNew: true }
}

export function generatePostExternalId(platform: SocialPlatform, sourceId: string): string {
  return createHash('sha256').update(`${platform}:${sourceId}`).digest('hex').slice(0, 16)
}
