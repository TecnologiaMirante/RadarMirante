import * as admin from 'firebase-admin'
import type { SocialConnector, CollectionResult, RawPost, RawComment } from './base'
import { ConnectorError, RateLimitError, AuthError } from './base'

// ─── Instagram Graph API connector ───────────────────────────────────────────
// Usa Business Login API (não Basic Display).
// Secrets necessários no Secret Manager:
//   INSTAGRAM_ACCESS_TOKEN  — User Access Token gerado no painel Meta
//   INSTAGRAM_ACCOUNT_ID    — ID numérico da conta Business do Instagram

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

interface IGMedia {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  permalink: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

interface IGComment {
  id: string
  text: string
  timestamp: string
  username?: string
  like_count?: number
  replies?: { data: IGComment[] }
}

interface IGPaging {
  cursors?: { before: string; after: string }
  next?: string
}

interface IGMediaResponse {
  data: IGMedia[]
  paging?: IGPaging
}

interface IGCommentResponse {
  data: IGComment[]
  paging?: IGPaging
}

async function igFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString())
  const body = await res.json() as { error?: { code: number; type: string; message: string } } & T

  if (body.error) {
    const { code, type, message } = body.error
    if (code === 190) throw new AuthError('instagram')
    if (code === 4 || code === 17 || type === 'OAuthException') throw new RateLimitError('instagram')
    throw new ConnectorError('instagram', `API error ${code}: ${message}`)
  }

  return body
}

function hashAuthor(username: string): string {
  let h = 0
  for (let i = 0; i < username.length; i++) {
    h = Math.imul(31, h) + username.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}

export class InstagramConnector implements SocialConnector {
  readonly platform = 'instagram' as const
  private lastResult: CollectionResult | null = null
  private token: string
  private accountId: string
  private db: admin.firestore.Firestore

  constructor(token: string, accountId: string, db: admin.firestore.Firestore) {
    this.token = token.trim()
    this.accountId = accountId.trim()
    this.db = db
  }

  // ─── Coleta posts publicados nas últimas 72h ─────────────────────────────

  async syncPosts(): Promise<void> {
    const started = Date.now()
    const errors: string[] = []
    let postsCollected = 0
    let commentsCollected = 0

    try {
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)

      const response = await igFetch<IGMediaResponse>(
        `/${this.accountId}/media`,
        this.token,
        {
          fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count',
          limit: '50',
        },
      )

      const recentPosts = response.data.filter(
        (m) => new Date(m.timestamp) >= cutoff,
      )

      for (const media of recentPosts) {
        try {
          const { id: firestoreId } = await this.upsertPostFull(media)
          postsCollected++

          const comments = await this.fetchComments(media.id)
          if (comments.length > 0) {
            await this.saveComments(firestoreId, comments)
            commentsCollected += comments.length
          }
        } catch (err) {
          errors.push(`post ${media.id}: ${(err as Error).message}`)
        }
      }
    } catch (err) {
      throw new ConnectorError('instagram', 'Falha ao sincronizar posts', err)
    }

    this.lastResult = {
      platform: 'instagram',
      postsCollected,
      commentsCollected,
      errors,
      durationMs: Date.now() - started,
    }
  }

  // ─── Backfill histórico completo ──────────────────────────────────────────
  // Pagina por TODOS os posts da conta (sem corte de data) e salva no
  // Firestore. Use uma vez para popular o histórico. Posts já existentes
  // têm apenas as métricas atualizadas; comentários são sempre re-salvos.

  async backfillAllPosts(
    since: Date,
    onProgress?: (msg: string) => void,
  ): Promise<{ total: number; created: number; updated: number; errors: string[] }> {
    let cursor: string | undefined
    let pageNum = 0
    let total = 0
    let created = 0
    let updated = 0
    const errors: string[] = []
    let reachedCutoff = false

    const BATCH = 5

    do {
      pageNum++
      const params: Record<string, string> = {
        fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count',
        limit: '100',
      }
      if (cursor) params['after'] = cursor

      const response = await igFetch<IGMediaResponse>(
        `/${this.accountId}/media`,
        this.token,
        params,
      )

      // Filtra posts dentro do período e detecta se chegamos ao corte
      const postsInRange = response.data.filter(m => {
        if (new Date(m.timestamp) < since) {
          reachedCutoff = true
          return false
        }
        return true
      })

      onProgress?.(`[página ${pageNum}] ${postsInRange.length}/${response.data.length} posts dentro do período`)

      for (let i = 0; i < postsInRange.length; i += BATCH) {
        const batch = postsInRange.slice(i, i + BATCH)

        const batchStart = total + 1
        total += batch.length

        await Promise.all(batch.map(async (media, bi) => {
          const idx = batchStart + bi
          try {
            const { id: firestoreId, isNew } = await this.upsertPostFull(media)
            if (isNew) created++
            else updated++

            const comments = await this.fetchComments(media.id)
            let commentCount = 0
            if (comments.length > 0) {
              await this.saveComments(firestoreId, comments)
              commentCount = comments.length
            }

            onProgress?.(`  [${idx}] ${media.timestamp.slice(0, 10)} ${isNew ? '✓ novo' : '↑ atualizado'} | ${commentCount} coment.`)
          } catch (err) {
            const msg = `${media.id} (${media.timestamp.slice(0, 10)}): ${(err as Error).message}`
            errors.push(msg)
            onProgress?.(`  [${idx}] ERRO: ${msg}`)
          }
        }))

        await new Promise(r => setTimeout(r, 300))
      }

      if (reachedCutoff) break

      cursor = response.paging?.cursors?.after
      if (!response.paging?.next) break

    } while (cursor)

    return { total, created, updated, errors }
  }

  // ─── Coleta comentários de um post específico ─────────────────────────────

  async syncComments(postId: string): Promise<void> {
    const postDoc = await this.db.collection('posts').doc(postId).get()
    if (!postDoc.exists) throw new ConnectorError('instagram', `Post ${postId} não encontrado`)

    const post = postDoc.data()!
    const externalId: string = post.externalId

    const comments = await this.fetchComments(externalId)
    await this.saveComments(postId, comments)

    await this.db.collection('posts').doc(postId).update({
      'metrics.comments': comments.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  // ─── Atualiza métricas de um post ────────────────────────────────────────

  async syncMetrics(postId: string): Promise<void> {
    const postDoc = await this.db.collection('posts').doc(postId).get()
    if (!postDoc.exists) throw new ConnectorError('instagram', `Post ${postId} não encontrado`)

    const post = postDoc.data()!
    const externalId: string = post.externalId

    const media = await igFetch<IGMedia>(
      `/${externalId}`,
      this.token,
      { fields: 'id,like_count,comments_count' },
    )

    await this.db.collection('posts').doc(postId).update({
      'metrics.likes': media.like_count ?? 0,
      'metrics.comments': media.comments_count ?? 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  getLastCollectionResult(): CollectionResult | null {
    return this.lastResult
  }

  // ─── Helpers internos ─────────────────────────────────────────────────────

  private async upsertPostFull(media: IGMedia): Promise<{ id: string; isNew: boolean }> {
    const externalId = media.id
    const existing = await this.db
      .collection('posts')
      .where('externalId', '==', externalId)
      .where('platform', '==', 'instagram')
      .limit(1)
      .get()

    const raw: RawPost = {
      externalId,
      url: media.permalink,
      text: media.caption ?? '',
      contentType: media.media_type.toLowerCase(),
      publishedAt: new Date(media.timestamp),
      metrics: {
        comments: media.comments_count ?? 0,
        likes: media.like_count ?? 0,
        shares: 0,
      },
    }

    if (existing.empty) {
      const ref = await this.db.collection('posts').add({
        ...raw,
        account: 'imirante',
        platform: 'instagram',
        status: 'monitoring',
        trendScore: 0,
        trendConfidence: 0,
        publishedAt: admin.firestore.Timestamp.fromDate(raw.publishedAt),
        collectedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return { id: ref.id, isNew: true }
    } else {
      await existing.docs[0].ref.update({
        'metrics.comments': raw.metrics.comments,
        'metrics.likes': raw.metrics.likes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return { id: existing.docs[0].id, isNew: false }
    }
  }

  private async fetchComments(mediaExternalId: string): Promise<RawComment[]> {
    const all: RawComment[] = []

    try {
      const response = await igFetch<IGCommentResponse>(
        `/${mediaExternalId}/comments`,
        this.token,
        {
          fields: 'id,text,timestamp,username,like_count,replies{id,text,timestamp,username,like_count}',
          limit: '200',
        },
      )

      console.log(`[instagram] fetchComments ${mediaExternalId}: ${response.data?.length ?? 0} comentários`)

      for (const c of response.data) {
        all.push({
          externalId: c.id,
          text: c.text,
          authorExternalId: c.username ?? c.id,
          likeCount: c.like_count,
          publishedAt: new Date(c.timestamp),
        })

        if (c.replies?.data) {
          for (const r of c.replies.data) {
            all.push({
              externalId: r.id,
              text: r.text,
              authorExternalId: r.username ?? r.id,
              likeCount: r.like_count,
              publishedAt: new Date(r.timestamp),
            })
          }
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof AuthError) throw err
      console.warn(`[instagram] Comentários indisponíveis para ${mediaExternalId}: ${(err as Error).message}`)
    }

    return all
  }

  private async saveComments(postId: string, comments: RawComment[]): Promise<void> {
    const batch = this.db.batch()
    const col = this.db.collection('posts').doc(postId).collection('comments')

    for (const c of comments) {
      if (!c.text) continue
      const ref = col.doc(c.externalId)
      batch.set(ref, {
        externalId: c.externalId,
        postId,
        platform: 'instagram',
        text: c.text,
        authorHash: hashAuthor(c.authorExternalId),
        likeCount: c.likeCount ?? 0,
        publishedAt: admin.firestore.Timestamp.fromDate(c.publishedAt),
        collectedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    await batch.commit()
  }
}
