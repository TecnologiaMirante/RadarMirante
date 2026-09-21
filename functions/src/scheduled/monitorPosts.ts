import * as admin from 'firebase-admin'
import type { RadarPost, RadarComment, PostStatus } from '../types/radar'
import { RADAR_CONFIG } from '../config/radar'
import { createSnapshot } from '../radar/snapshots'
import { getBucket, getPostAgeMinutes, getBaseline } from '../radar/baseline'
import { calculatePenalties } from '../radar/penalties'
import { calculateStatisticalTrendScore } from '../radar/score'
import { queueAnalysis, shouldReanalyze } from '../tasks/queueAnalysis'

// ─── Pipeline de monitoramento ────────────────────────────────────────────────
// Roda a cada 15 minutos via Cloud Scheduler.
// Para cada post ativo: snapshot → score → atualiza post → (ETAPA 6: queue AI).

export async function monitorActivePosts(db: admin.firestore.Firestore): Promise<void> {
  const cutoffMs = RADAR_CONFIG.monitoring.activePostHours * 60 * 60 * 1000
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - cutoffMs)

  const snap = await db
    .collection('posts')
    .where('status', 'in', ['monitoring', 'candidate', 'trending'])
    .where('publishedAt', '>=', cutoff)
    .get()

  console.log(`[monitorPosts] ${snap.size} posts ativos`)
  if (snap.empty) return

  await Promise.allSettled(
    snap.docs.map((doc) => processPost(db, { id: doc.id, ...doc.data() } as RadarPost & { id: string })),
  )
}

async function processPost(
  db: admin.firestore.Firestore,
  post: RadarPost & { id: string },
): Promise<void> {
  try {
    // 1. Busca comentários do Firestore (populados pelo connector, quando existir)
    const commentSnap = await db
      .collection('posts')
      .doc(post.id)
      .collection('comments')
      .get()

    const comments = commentSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as RadarComment & { id: string }),
    )

    // 2. Snapshot com métricas atuais
    const snapshot = await createSnapshot(db, post.id, comments, post.metrics)

    // 3. Baseline para comparação
    const ageMinutes = getPostAgeMinutes(post.publishedAt)
    const bucket = getBucket(ageMinutes)
    const baseline = await getBaseline(db, post.platform, bucket)

    const baselineP90 = baseline?.p90 ?? 0
    const baselineP75 = baseline?.p75 ?? 0

    // 4. Penalidades
    const penalties = calculatePenalties(comments)

    // 5. Score estatístico
    const breakdown = calculateStatisticalTrendScore({
      commentVelocity: snapshot.commentVelocity,
      acceleration: snapshot.acceleration,
      commentCount: snapshot.comments,
      uniqueAuthors15m: snapshot.uniqueAuthors15m,
      likesCount: snapshot.likes,
      baselineP90,
      baselineP75,
      spamRatio: penalties.spamRatio,
      duplicateRatio: penalties.duplicateRatio,
      authorConcentration: penalties.authorConcentration,
    })

    // 6. Baseline comparison (% acima do p90)
    const baselineComparison = baselineP90 > 0
      ? ((snapshot.comments - baselineP90) / baselineP90) * 100
      : 0

    // 7. Status baseado no score
    const newStatus = resolveStatus(breakdown.finalScore, post.status)

    // 8. Persiste score e status no post
    await db.collection('posts').doc(post.id).update({
      trendScore: breakdown.finalScore,
      trendConfidence: breakdown.confidence,
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(
      `[monitorPosts] ${post.id} score=${breakdown.finalScore} ` +
      `bucket=${bucket} status=${newStatus}`,
    )

    // 9. Elegível para análise de IA?
    const eligible =
      breakdown.finalScore >= RADAR_CONFIG.trend.aiThreshold &&
      snapshot.comments >= RADAR_CONFIG.trend.minComments

    if (eligible) {
      // Verifica se precisa re-analisar (tem analysis run anterior?)
      const lastRunSnap = await db
        .collection('analysisRuns')
        .where('postId', '==', post.id)
        .where('status', '==', 'completed')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()

      let shouldQueue = lastRunSnap.empty

      if (!lastRunSnap.empty) {
        const lastRun = lastRunSnap.docs[0].data()
        const { should } = await shouldReanalyze(
          lastRun.commentsAtTrigger,
          snapshot.comments,
          lastRun.scoreAtTrigger,
          breakdown.finalScore,
          lastRun.createdAt.toDate(),
        )
        shouldQueue = should
      }

      if (shouldQueue) {
        try {
          await queueAnalysis({
            postId: post.id,
            platform: post.platform,
            trendScore: breakdown.finalScore,
            triggeredBy: 'score',
          })
          console.log(`[monitorPosts] ${post.id} enfileirado para análise IA`)
        } catch (queueErr) {
          // Não falha o ciclo inteiro se o queue falhar
          console.error(`[monitorPosts] Erro ao enfileirar ${post.id}:`, queueErr)
        }
      }
    }

    void baselineComparison
  } catch (err) {
    console.error(`[monitorPosts] Erro ao processar ${post.id}:`, err)
  }
}

function resolveStatus(score: number, current: PostStatus): PostStatus {
  // Não regride status já avançado (analyzed, archived)
  if (current === 'analyzed' || current === 'archived') return current
  if (score >= 65) return 'trending'
  if (score >= 40) return 'candidate'
  return 'monitoring'
}
