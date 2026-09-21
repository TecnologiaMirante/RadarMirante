// Espelha src/config/radar.ts do frontend.
// Fonte única de configuração para o backend.

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
    reanalyzeGrowthPercentage: 40,
    maxCommentsPerAnalysis: 300,
    minIntervalBetweenAnalysisHours: 2,
    reanalyzeScoreIncrease: 15,
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
