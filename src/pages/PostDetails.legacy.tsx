import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, TrendingUp, MessageCircle, Heart, Share2, Eye,
  Lightbulb, AlertTriangle, HelpCircle, Megaphone, FileText, Zap, Clock, Sparkles,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScoreBadge } from '@/components/radar/ScoreBadge'
import { PlatformBadge } from '@/components/radar/PlatformBadge'
import { getPost, getPostOpportunity, submitFeedback, triggerPostAnalysis, getPostComments } from '@/services/radar'
import { WordCloud } from '@/components/radar/WordCloud'
import { useAuth } from '@/hooks/useAuth'
import type { RadarPost, Opportunity, RadarComment, StoryIdea, TopicCluster, ClaimToVerify } from '@/types/radar'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}{title}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  )
}

function StringList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-foreground flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>{item}
        </li>
      ))}
    </ul>
  )
}

function ClusterBar({ cluster }: { cluster: TopicCluster }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground font-medium truncate">{cluster.topic}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0">{cluster.percentage}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${cluster.percentage}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{cluster.summary}</p>
    </div>
  )
}

function ClaimCard({ claim }: { claim: ClaimToVerify }) {
  return (
    <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-3 space-y-1">
      <p className="text-sm font-medium text-foreground">"{claim.claim}"</p>
      <p className="text-xs text-muted-foreground">~{claim.approximateMentions} menções · {claim.context}</p>
    </div>
  )
}

function StoryIdeaCard({ idea, index }: { idea: StoryIdea; index: number }) {
  const priorityColor = {
    high: 'border-orange-500/30 bg-orange-500/5',
    medium: 'border-primary/20 bg-primary/5',
    low: 'border-border bg-card',
  }[idea.priority]
  const priorityLabel = { high: 'URGENTE', medium: 'RELEVANTE', low: 'MONITORE' }[idea.priority]
  const priorityTextColor = { high: 'text-orange-400', medium: 'text-primary', low: 'text-muted-foreground' }[idea.priority]

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', priorityColor)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">PAUTA {index + 1}</span>
        <span className={cn('text-xs font-bold tracking-wider', priorityTextColor)}>{priorityLabel}</span>
      </div>
      <h4 className="font-bold text-foreground leading-tight">{idea.headline}</h4>
      <p className="text-sm text-muted-foreground">{idea.angle}</p>
      <p className="text-xs text-muted-foreground italic">
        <strong className="text-foreground not-italic">Por que agora:</strong> {idea.whyNow}
      </p>
      {idea.questionsToAnswer.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Perguntas para investigar:</p>
          <ul className="space-y-1">
            {idea.questionsToAnswer.map((q, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5 flex-shrink-0">→</span>{q}
              </li>
            ))}
          </ul>
        </div>
      )}
      {idea.suggestedSources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {idea.suggestedSources.map((s, i) => (
            <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function FeedbackBar({ opportunityId, userId }: { opportunityId: string; userId: string }) {
  const [sent, setSent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  async function send(useful: boolean) {
    if (sent !== null || loading) return
    setLoading(true)
    try { await submitFeedback(opportunityId, userId, useful); setSent(useful) }
    catch (err) { console.error('[Feedback]', err) }
    finally { setLoading(false) }
  }

  if (sent !== null) {
    return <p className="text-sm text-muted-foreground text-center py-2">{sent ? '👍 Obrigado!' : '👎 Feedback registrado.'}</p>
  }
  return (
    <div className="flex items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">Esta análise foi útil?</p>
      <Button variant="outline" size="sm" onClick={() => void send(true)} disabled={loading}>👍 Sim</Button>
      <Button variant="outline" size="sm" onClick={() => void send(false)} disabled={loading}>👎 Não</Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostDetails() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState<RadarPost | null>(null)
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [comments, setComments] = useState<RadarComment[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [showAllComments, setShowAllComments] = useState(false)

  useEffect(() => {
    if (!postId) return
    Promise.all([getPost(postId), getPostOpportunity(postId), getPostComments(postId, 50)])
      .then(([p, o, c]) => { setPost(p); setOpportunity(o); setComments(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [postId])

  async function handleAnalyze() {
    if (!postId || analyzing) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      await triggerPostAnalysis(postId)
      const [p, o] = await Promise.all([getPost(postId), getPostOpportunity(postId)])
      setPost(p)
      setOpportunity(o)
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro ao analisar')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-card rounded" />
        <div className="h-40 bg-card rounded-xl" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <p className="text-sm text-destructive">Post não encontrado.</p>
      </div>
    )
  }

  const publishedAgo = formatDistanceToNow(post.publishedAt.toDate(), { addSuffix: true, locale: ptBR })

  return (
    <div className="space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Radar
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ScoreBadge score={post.trendScore} size="lg" />
          <PlatformBadge platform={post.platform} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />{publishedAgo}
          </span>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-5 text-sm flex-wrap">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <strong className="text-foreground">{post.metrics.comments.toLocaleString('pt-BR')}</strong> comentários
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Heart className="w-4 h-4" />
            <strong className="text-foreground">{post.metrics.likes.toLocaleString('pt-BR')}</strong> curtidas
          </span>
          {post.metrics.shares > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Share2 className="w-4 h-4" />
              <strong className="text-foreground">{post.metrics.shares.toLocaleString('pt-BR')}</strong> compartilhamentos
            </span>
          )}
          {post.metrics.views != null && post.metrics.views > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="w-4 h-4" />
              <strong className="text-foreground">{post.metrics.views.toLocaleString('pt-BR')}</strong> visualizações
            </span>
          )}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline ml-auto text-xs"
          >
            Ver publicação <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Legenda */}
        {post.text && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{post.text}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Nuvem de palavras dos comentários */}
      {comments.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircle className="w-4 h-4" />
              O que estão comentando ({comments.length} comentários coletados)
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <WordCloud texts={comments.map((c) => c.text)} />
          </CardContent>
        </Card>
      )}

      {/* Comentários reais */}
      {comments.length > 0 && (
        <Section icon={<MessageCircle className="w-4 h-4" />} title="Comentários recentes">
          <div className="space-y-3">
            {(showAllComments ? comments : comments.slice(0, 8)).map((c) => (
              <div key={c.id} className="text-sm border-l-2 border-border pl-3 py-0.5">
                <p className="text-foreground">{c.text}</p>
                {c.likeCount != null && c.likeCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">❤️ {c.likeCount}</p>
                )}
              </div>
            ))}
            {comments.length > 8 && (
              <button
                onClick={() => setShowAllComments((v) => !v)}
                className="text-xs text-primary hover:underline"
              >
                {showAllComments ? 'Mostrar menos' : `Ver mais ${comments.length - 8} comentários`}
              </button>
            )}
          </div>
        </Section>
      )}

      {/* Análise da IA — se existir */}
      {opportunity ? (
        <>
          <Card>
            <CardContent className="p-5 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tópico principal</p>
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wide">{opportunity.mainTopic}</h2>
              <p className="text-muted-foreground text-sm">{opportunity.summary}</p>
              {opportunity.baselineComparison > 0 && (
                <span className="flex items-center gap-1.5 text-orange-400 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <strong>+{Math.round(opportunity.baselineComparison)}%</strong> acima do esperado
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por que está em alta</p>
              <p className="text-foreground text-sm">{opportunity.whyTrending}</p>
            </CardContent>
          </Card>

          {opportunity.storyIdeas.length > 0 && (
            <Section icon={<Lightbulb className="w-4 h-4 text-primary" />} title="Pautas sugeridas">
              <div className="space-y-3">
                {opportunity.storyIdeas.map((idea, i) => <StoryIdeaCard key={i} idea={idea} index={i} />)}
              </div>
            </Section>
          )}

          {opportunity.clusters.length > 0 && (
            <Section icon={<MessageCircle className="w-4 h-4" />} title="O que as pessoas estão discutindo">
              <div className="space-y-4">
                {opportunity.clusters.map((c, i) => <ClusterBar key={i} cluster={c} />)}
              </div>
            </Section>
          )}

          {opportunity.claimsToVerify.length > 0 && (
            <Section icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} title="Alegações que precisam de verificação">
              <div className="space-y-2">
                {opportunity.claimsToVerify.map((c, i) => <ClaimCard key={i} claim={c} />)}
              </div>
            </Section>
          )}

          {opportunity.audienceQuestions.length > 0 && (
            <Section icon={<HelpCircle className="w-4 h-4" />} title="O que a audiência quer saber">
              <StringList items={opportunity.audienceQuestions} emptyMessage="Nenhuma pergunta identificada." />
            </Section>
          )}

          {opportunity.reports.length > 0 && (
            <Section icon={<FileText className="w-4 h-4" />} title="Relatos de testemunhas">
              <StringList items={opportunity.reports} emptyMessage="Nenhum relato." />
            </Section>
          )}

          {opportunity.complaints.length > 0 && (
            <Section icon={<Megaphone className="w-4 h-4" />} title="Principais reclamações">
              <StringList items={opportunity.complaints} emptyMessage="Nenhuma reclamação." />
            </Section>
          )}

          {opportunity.editorialSignals.length > 0 && (
            <Section icon={<Zap className="w-4 h-4 text-primary" />} title="Sinais editoriais">
              <StringList items={opportunity.editorialSignals} emptyMessage="Nenhum sinal." />
            </Section>
          )}

          {user && (
            <Card>
              <CardContent className="p-5">
                <FeedbackBar opportunityId={opportunity.id} userId={user.uid} />
              </CardContent>
            </Card>
          )}

          <div className="text-center text-xs text-muted-foreground pb-4">
            Confiança da análise: <strong className="text-foreground">{Math.round(opportunity.analysisConfidence * 100)}%</strong>
            {' · '}Potencial editorial: <strong className="text-foreground">{opportunity.editorialPotential}/100</strong>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-5 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Análise editorial ainda não disponível para esta publicação.
            </p>
            {analyzeError && (
              <p className="text-xs text-destructive">{analyzeError}</p>
            )}
            <Button
              onClick={() => void handleAnalyze()}
              disabled={analyzing}
              className="gap-2"
            >
              <Sparkles className={cn('w-4 h-4', analyzing && 'animate-pulse')} />
              {analyzing ? 'Analisando com IA…' : 'Analisar agora'}
            </Button>
            <p className="text-xs text-muted-foreground">
              A IA vai examinar os comentários e sugerir pautas jornalísticas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
