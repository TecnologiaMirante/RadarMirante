import * as admin from 'firebase-admin'
import type {
  Opportunity,
  EditorialAnalysis,
  ViralAnalysis,
  RadarPost,
  OpportunityStatus,
  AccountProfile,
} from '../types/radar'

const FieldValue = admin.firestore.FieldValue

function isViralAnalysis(a: EditorialAnalysis | ViralAnalysis): a is ViralAnalysis {
  return 'viralPotential' in a
}

export async function createOrUpdateOpportunity(
  db: admin.firestore.Firestore,
  post: RadarPost & { id: string },
  analysis: EditorialAnalysis | ViralAnalysis,
  trendScore: number,
  trendConfidence: number,
  baselineComparison: number,
  profile: AccountProfile = 'editorial',
): Promise<string> {
  const existing = await db
    .collection('opportunities')
    .where('postId', '==', post.id)
    .limit(1)
    .get()

  const now = FieldValue.serverTimestamp()

  const base: Omit<Opportunity, 'id' | 'createdAt'> = {
    postId: post.id,
    account: post.account,
    profile,
    platform: post.platform,
    postUrl: post.url,
    ...(post.title ? { postTitle: post.title } : {}),
    mainTopic: analysis.mainTopic,
    summary: analysis.summary,
    whyTrending: analysis.whyTrending,
    clusters: analysis.clusters,
    trendScore,
    trendConfidence,
    analysisConfidence: analysis.confidence,
    commentsAtAnalysis: post.metrics.comments,
    metricsAtAnalysis: post.metrics,
    baselineComparison,
    status: 'new' as OpportunityStatus,
    updatedAt: now as unknown as admin.firestore.Timestamp,
    lastAnalysisAt: now as unknown as admin.firestore.Timestamp,
  }

  const profileFields = isViralAnalysis(analysis)
    ? {
      emotionalTriggers: analysis.emotionalTriggers,
      contentInsights: analysis.contentInsights,
      audienceSignals: analysis.audienceSignals,
      contentRecommendations: analysis.contentRecommendations,
      viralPotential: analysis.viralPotential,
    }
    : {
      audienceQuestions: analysis.audienceQuestions,
      complaints: analysis.complaints,
      reports: analysis.reports,
      claimsToVerify: analysis.claimsToVerify,
      editorialSignals: analysis.editorialSignals,
      storyIdeas: analysis.storyIdeas,
      editorialPotential: analysis.editorialPotential,
    }

  const opportunityData = { ...base, ...profileFields }

  if (!existing.empty) {
    const ref = existing.docs[0].ref
    await ref.update({
      ...opportunityData,
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
