import * as admin from 'firebase-admin'
import { createHash } from 'crypto'
import type { RawComment } from '../connectors/base'
import type { RadarComment, SocialPlatform } from '../types/radar'

const Timestamp = admin.firestore.Timestamp

// ─── Normalização de Comment ──────────────────────────────────────────────────
// Anonimiza o autor via hash antes de salvar.
// Não armazena nome, avatar ou qualquer dado identificável.

export async function normalizeAndSaveComment(
  db: admin.firestore.Firestore,
  platform: SocialPlatform,
  postId: string,
  raw: RawComment,
): Promise<{ commentId: string; isNew: boolean }> {
  const commentsRef = db.collection('posts').doc(postId).collection('comments')

  // Verifica duplicata
  const existing = await commentsRef
    .where('externalId', '==', raw.externalId)
    .limit(1)
    .get()

  if (!existing.empty) {
    return { commentId: existing.docs[0].id, isNew: false }
  }

  // Anonimização: hash do authorExternalId com salt da plataforma
  const authorHash = hashAuthor(platform, raw.authorExternalId)

  const newComment: Omit<RadarComment, 'id'> = {
    externalId: raw.externalId,
    postId,
    platform,
    text: raw.text,
    authorHash,
    ...(raw.likeCount !== undefined ? { likeCount: raw.likeCount } : {}),
    ...(raw.replyCount !== undefined ? { replyCount: raw.replyCount } : {}),
    publishedAt: Timestamp.fromDate(raw.publishedAt),
    collectedAt: Timestamp.now(),
  }

  const ref = await commentsRef.add(newComment)
  return { commentId: ref.id, isNew: true }
}

// Hash unidirecional — não é possível recuperar o ID original
function hashAuthor(platform: SocialPlatform, authorId: string): string {
  return createHash('sha256')
    .update(`${platform}:author:${authorId}`)
    .digest('hex')
    .slice(0, 24)
}
