import type { Timestamp } from 'firebase/firestore'

// ─── Métricas diárias da conta Instagram ─────────────────────────────────────
// Salvas em Firestore: instagramInsights/{YYYY-MM-DD}

export interface InstagramDailyInsight {
  date: string            // 'YYYY-MM-DD'
  impressions: number
  reach: number
  profileViews: number
  websiteClicks: number
  followerCount: number
  followerGain: number    // diferença em relação ao dia anterior
  accountsEngaged?: number  // contas que curtiram/comentaram/salvaram/compartilharam
  totalInteractions?: number // soma de todas as interações
  updatedAt: Timestamp
}

// ─── Métricas por post Instagram ─────────────────────────────────────────────
// Salvas em posts/{id}.insights

export interface InstagramPostInsights {
  reach: number
  impressions: number
  saved: number
  shares?: number
  videoViews?: number
  plays?: number          // Reels: total de reproduções
  avgWatchTime?: number   // Reels: tempo médio assistido em milissegundos
  updatedAt: Timestamp
}

// ─── Estado da conta Instagram ────────────────────────────────────────────────
// Salvo em instagramAccount/profile

export interface InstagramAccountProfile {
  username: string
  name: string
  biography?: string
  followersCount: number
  followsCount: number
  mediaCount: number
  profilePictureUrl?: string
  website?: string
  updatedAt: Timestamp
}

// ─── Audiência online por hora ────────────────────────────────────────────────
// Array de 24 valores (hora 0..23) de onlineFollowers médio

export interface InstagramOnlineFollowers {
  date: string           // 'YYYY-MM-DD'
  byHour: number[]       // index = hora (0-23), valor = % de seguidores online
  updatedAt: Timestamp
}

// ─── Matriz de atividade semanal ──────────────────────────────────────────────
// matrix[dayOfWeek (0=Dom)][hour (0-23)] = contagem absoluta de seguidores online

export interface InstagramWeeklyActivity {
  matrix: number[][]     // 7 linhas × 24 colunas
  updatedAt: Timestamp
}

// ─── Insights agregados (últimos 30 dias) ─────────────────────────────────────
// Salvo em instagramAccount/{radarId}/aggregateInsights/last30d

export interface InstagramAggregateInsights {
  views?: number
  viewsByFollowType?: Record<string, number>        // FOLLOWER, NON_FOLLOWER
  viewsByMediaType?: Record<string, number>         // POST, REEL, STORY
  reach?: number
  reachByFollowType?: Record<string, number>
  reachByMediaType?: Record<string, number>
  interactionsByFollowType?: Record<string, number>
  interactionsByMediaType?: Record<string, number>
  updatedAt: Timestamp
}

// ─── Audiência demográfica ─────────────────────────────────────────────────────
// Salva em instagramAudience/{metric}

export interface InstagramAudienceDoc {
  metric: string
  data: Record<string, number>
  updatedAt: Timestamp
}

export interface InstagramAudience {
  genderAge: Record<string, number>   // 'M.18-24' → count
  countries: Record<string, number>   // 'BR' → count
  cities: Record<string, number>      // 'São Paulo, SP' → count
}
