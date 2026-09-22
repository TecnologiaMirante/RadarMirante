// Configuração central do Mirante Radar.
// Todos os parâmetros operacionais ficam aqui — sem números mágicos no código.

export const RADAR_CONFIG = {
  monitoring: {
    // Quantas horas um post permanece em monitoramento ativo
    activePostHours: 72,
    // Intervalo entre snapshots (minutos)
    snapshotIntervalMinutes: 15,
  },

  trend: {
    // Score mínimo para acionar análise de IA
    aiThreshold: 65,
    // Comentários mínimos para acionar análise
    minComments: 10,
    // Autores únicos mínimos para acionar análise
    minUniqueAuthors: 5,
  },

  analysis: {
    // Percentual de crescimento de comentários que força reanálise
    reanalyzeGrowthPercentage: 40,
    // Máximo de comentários enviados para a IA por análise
    maxCommentsPerAnalysis: 300,
    // Intervalo mínimo entre análises do mesmo post (horas)
    minIntervalBetweenAnalysisHours: 2,
    // Score mínimo de aumento para forçar reanálise
    reanalyzeScoreIncrease: 15,
  },

  score: {
    // Pesos dos componentes do Trend Score (total = 100%)
    weights: {
      anomaly: 0.30,
      velocity: 0.25,
      volume: 0.15,
      uniqueAuthors: 0.15,
      acceleration: 0.10,
      additional: 0.05,
    },
    // Penalidade máxima por spam (0 a 1)
    maxSpamPenalty: 0.3,
    // Penalidade máxima por duplicatas
    maxDuplicatePenalty: 0.2,
    // Penalidade máxima por concentração de autores
    maxAuthorConcentrationPenalty: 0.25,
  },

  baseline: {
    // Buckets de tempo para baseline histórico
    buckets: ['0-30m', '30-120m', '2-6h', '6-24h', '1-3d'] as const,
    // Amostras mínimas para calcular baseline confiável
    minSamplesForBaseline: 30,
  },

  cloudTasks: {
    // Fila de análise de IA
    analysisQueueName: 'radar-analysis',
    // Tentativas máximas em caso de falha
    maxRetries: 3,
    // Delay inicial de retry (segundos)
    retryDelaySeconds: 30,
  },
} as const

export type RadarConfig = typeof RADAR_CONFIG
