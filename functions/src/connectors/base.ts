import type { SocialPlatform } from '../types/radar'

export interface CollectionResult {
  platform: SocialPlatform
  postsCollected: number
  commentsCollected: number
  errors: string[]
  durationMs: number
}

// ─── Interface comum para todos os connectors ─────────────────────────────────
// O resto da aplicação não conhece a estrutura interna de cada API.
// Cada connector implementa esta interface e lida com sua própria autenticação,
// rate limits e parsing de resposta.

export interface SocialConnector {
  readonly platform: SocialPlatform

  // Coleta novos posts publicados desde a última coleta
  syncPosts(): Promise<void>

  // Coleta comentários de um post específico
  syncComments(postId: string): Promise<void>

  // Atualiza métricas (likes, shares, views) de um post
  syncMetrics(postId: string): Promise<void>

  // Retorna resultado resumido da última operação de coleta
  getLastCollectionResult(): CollectionResult | null
}

// ─── Dados normalizados (antes de salvar no Firestore) ────────────────────────

export interface RawPost {
  externalId: string
  url: string
  title?: string
  text: string
  contentType?: string
  publishedAt: Date
  metrics: {
    comments: number
    likes: number
    shares: number
    views?: number
    replies?: number
  }
}

export interface RawComment {
  externalId: string
  text: string
  authorExternalId: string
  likeCount?: number
  replyCount?: number
  publishedAt: Date
}

// ─── Erros tipados ────────────────────────────────────────────────────────────

export class ConnectorError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${platform}] ${message}`)
    this.name = 'ConnectorError'
  }
}

export class RateLimitError extends ConnectorError {
  constructor(platform: SocialPlatform, public readonly retryAfterMs?: number) {
    super(platform, 'Rate limit atingido')
    this.name = 'RateLimitError'
  }
}

export class AuthError extends ConnectorError {
  constructor(platform: SocialPlatform) {
    super(platform, 'Falha de autenticação — verifique as credenciais no Secret Manager')
    this.name = 'AuthError'
  }
}
