import * as admin from 'firebase-admin'
import type {
  Opportunity,
  EditorialAnalysis,
  RadarPost,
  OpportunityStatus,
} from '../types/radar'

const FieldValue = admin.firestore.FieldValue

// ─── Criação e atualização de Opportunities ───────────────────────────────────

export async function createOrUpdateOpportunity(
  db: admin.firestore.Firestore,
  post: RadarPost & { id: string },
  analysis: EditorialAnalysis,
  trendScore: number,
  trendConfidence: number,
  baselineComparison: number,
): Promise<string> {
  // Verifica se já existe opportunity para este post
  const existing = await db
    .collection('opportunities')
    .where('postId', '==', post.id)
    .limit(1)
    .get()

  const now = FieldValue.serverTimestamp()

  const opportunityData: Omit<Opportunity, 'id' | 'createdAt'> = {
    postId: post.id,
    platform: post.platform,
    postUrl: post.url,
    ...(post.title ? { postTitle: post.title } : {}),

    mainTopic: analysis.mainTopic,
    summary: analysis.summary,
    whyTrending: analysis.whyTrending,
    clusters: analysis.clusters,
    audienceQuestions: analysis.audienceQuestions,
    complaints: analysis.complaints,
    reports: analysis.reports,
    claimsToVerify: analysis.claimsToVerify,
    editorialSignals: analysis.editorialSignals,
    storyIdeas: analysis.storyIdeas,

    trendScore,
    trendConfidence,
    editorialPotential: analysis.editorialPotential,
    analysisConfidence: analysis.confidence,

    commentsAtAnalysis: post.metrics.comments,
    metricsAtAnalysis: post.metrics,
    baselineComparison,

    status: 'new' as OpportunityStatus,
    updatedAt: now as unknown as admin.firestore.Timestamp,
    lastAnalysisAt: now as unknown as admin.firestore.Timestamp,
  }

  if (!existing.empty) {
    const ref = existing.docs[0].ref
    await ref.update({
      ...opportunityData,
      // Preserva status se já foi revisado
      ...(existing.docs[0].data().status !== 'new' ? { status: undefined } : {}),
    })
    return ref.id
  }

  const ref = await db.collection('opportunities').add({
    ...opportunityData,
    createdAt: now,
  })

  return ref.id
}
