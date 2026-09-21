import { CloudTasksClient } from '@google-cloud/tasks'
import type { SocialPlatform } from '../types/radar'
import { RADAR_CONFIG } from '../config/radar'

export interface AnalysisTask {
  postId: string
  platform: SocialPlatform
  trendScore: number
  triggeredBy: 'score' | 'growth' | 'cluster' | 'interval' | 'manual'
}

// Configuração via environment — definida no Firebase Console ou .env das functions.
// ANALYZE_POST_URL: URL da Cloud Function analyzePost
//   ex: https://analyzepost-XXXX-rj.a.run.app  (v2 usa Cloud Run)
// TASKS_SA_EMAIL: Service account com papel Cloud Tasks Enqueuer + invoker da função
//   ex: radar-tasks@radarimirante.iam.gserviceaccount.com
// TASKS_LOCATION: região da fila (padrão: southamerica-east1)
// TASKS_QUEUE: nome da fila (padrão: radar-analysis)

function getEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (!val) throw new Error(`Env var ${key} não configurada — veja .env.functions`)
  return val
}

let client: CloudTasksClient | null = null

function getClient(): CloudTasksClient {
  if (!client) client = new CloudTasksClient()
  return client
}

export async function queueAnalysis(task: AnalysisTask): Promise<void> {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'radarimirante'
  const location = getEnv('TASKS_LOCATION', 'southamerica-east1')
  const queueName = getEnv('TASKS_QUEUE', RADAR_CONFIG.cloudTasks.analysisQueueName)
  const functionUrl = getEnv('ANALYZE_POST_URL')
  const saEmail = getEnv('TASKS_SA_EMAIL')

  const parent = `projects/${project}/locations/${location}/queues/${queueName}`

  await getClient().createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: functionUrl,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(task)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: saEmail,
          audience: functionUrl,
        },
      },
      // Delay de 5s para dar tempo ao Firestore propagar o snapshot
      scheduleTime: { seconds: Math.floor(Date.now() / 1000) + 5 },
    },
  })
}

export async function shouldReanalyze(
  lastAnalysisComments: number,
  currentComments: number,
  lastScore: number,
  currentScore: number,
  lastAnalysisAt: Date,
): Promise<{ should: boolean; reason?: string }> {
  const { analysis } = RADAR_CONFIG

  const hoursSince = (Date.now() - lastAnalysisAt.getTime()) / (1000 * 60 * 60)
  if (hoursSince < analysis.minIntervalBetweenAnalysisHours) return { should: false }

  const growth =
    lastAnalysisComments > 0
      ? ((currentComments - lastAnalysisComments) / lastAnalysisComments) * 100
      : 0

  if (growth >= analysis.reanalyzeGrowthPercentage) return { should: true, reason: 'growth' }
  if (currentScore - lastScore >= analysis.reanalyzeScoreIncrease) return { should: true, reason: 'score' }

  return { should: false }
}
