// Espelha src/config/radar.ts do frontend.
// Fonte única de configuração para o backend.

// Mapeamento estático de conta → perfil.
// Atualizar ao adicionar novas contas em getActiveAccounts().
export const ACCOUNT_PROFILES: Record<string, 'editorial' | 'viral'> = {
  imirante:        'editorial',
  tvmirante:       'viral',
  imiranteesporte: 'viral',
}

// Tetos de scoring por perfil.
// 'editorial': conta grande, alto engajamento (iMirante)
// 'viral':     conta menor, engajamento mais baixo — tetos menores = maior sensibilidade
export const PROFILE_SCORING = {
  editorial: { commentCeiling: 300, velocityMaxPerMin: 2.0, uniqueAuthorMax: 20 },
  viral:     { commentCeiling: 75,  velocityMaxPerMin: 0.5, uniqueAuthorMax: 8  },
} as const

export const RADAR_CONFIG = {
  monitoring: {
    activePostHours: 72,
    snapshotIntervalMinutes: 15,
  },

  trend: {
    aiThreshold: 40,
    minComments: 5,
    minUniqueAuthors: 2,
  },

  analysis: {
    reanalyzeGrowthPercentage: 60,
    maxCommentsPerAnalysis: 300,
    minIntervalBetweenAnalysisHours: 12,
    reanalyzeScoreIncrease: 20,
  },

  score: {
    weights: {
      anomaly: 0.30,
      velocity: 0.25,
      volume: 0.15,
      uniqueAuthors: 0.15,
      acceleration: 0.05,
      additional: 0.10,  // usado para likes/reações
    },
    maxSpamPenalty: 0.3,
    maxDuplicatePenalty: 0.2,
    maxAuthorConcentrationPenalty: 0.25,
  },

  baseline: {
    buckets: ['0-30m', '30-120m', '2-6h', '6-24h', '1-3d'] as const,
    minSamplesForBaseline: 30,
  },

  cloudTasks: {
    analysisQueueName: 'radar-analysis',
    maxRetries: 3,
    retryDelaySeconds: 30,
  },
} as const
