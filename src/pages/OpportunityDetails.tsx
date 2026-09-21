import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, TrendingUp, MessageCircle, ThumbsUp, ThumbsDown,
  Lightbulb, AlertTriangle, HelpCircle, Megaphone, FileText, Zap, Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScoreBadge } from '@/components/radar/ScoreBadge'
import { PlatformBadge } from '@/components/radar/PlatformBadge'
import { getOpportunity, submitFeedback } from '@/services/radar'
import { useAuth } from '@/hooks/useAuth'
import type { Opportunity, StoryIdea, TopicCluster, ClaimToVerify } from '@/types/radar'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {children}
      </CardContent>
    </Card>
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
                <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {idea.suggestedSources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {idea.suggestedSources.map((s, i) => (
            <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
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
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${cluster.percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{cluster.summary}</p>
    </div>
  )
}

function ClaimCard({ claim }: { claim: ClaimToVerify }) {
  return (
    <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-3 space-y-1">
      <p className="text-sm font-medium text-foreground">"{claim.claim}"</p>
      <p className="text-xs text-muted-foreground">
        ~{claim.approximateMentions} menções · {claim.context}
      </p>
    </div>
  )
}

function StringList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-foreground flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function FeedbackBar({ opportunityId, userId }: { opportunityId: string; userId: string }) {
  const [sent, setSent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  async function send(useful: boolean) {
    if (sent !== null || loading) return
    setLoading(true)
    try {
      await submitFeedback(opportunityId, userId, useful)
      setSent(useful)
    } catch (err) {
      console.error('[Feedback]', err)
    } finally {
      setLoading(false)
    }
  }

  if (sent !== null) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        {sent ? '👍 Obrigado pelo feedback!' : '👎 Feedback registrado.'}
      </p>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">Esta análise foi útil?</p>
      <Button variant="outline" size="sm" onClick={() => void send(true)} disabled={loading} className="gap-2">
        <ThumbsUp className="w-3.5 h-3.5" /> Sim
      </Button>
      <Button variant="outline" size="sm" onClick={() => void send(false)} disabled={loading} className="gap-2">
        <ThumbsDown className="w-3.5 h-3.5" /> Não
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpportunityDetails() {
  const { opportunityId } = useParams<{ opportunityId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opportunityId) return
    getOpportunity(opportunityId)
      .then(setOpportunity)
      .catch(() => setError('Não foi possível carregar esta oportunidade.'))
      .finally(() => setLoading(false))
  }, [opportunityId])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-card rounded" />
        <div className="h-40 bg-card rounded-xl" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    )
  }

  if (error || !opportunity) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <p className="text-sm text-destructive">{error ?? 'Oportunidade não encontrada.'}</p>
      </div>
    )
  }

  const createdAgo = formatDistanceToNow((opportunity.createdAt as unknown as Timestamp).toDate(), {
    addSuffix: true, locale: ptBR,
  })

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Voltar */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Radar
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ScoreBadge score={opportunity.trendScore} size="lg" />
          <PlatformBadge platform={opportunity.platform} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />
            {createdAgo}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          {opportunity.mainTopic}
        </h1>

        <p className="text-muted-foreground">{opportunity.summary}</p>

        {/* Métricas */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" />
            <strong className="text-foreground">{opportunity.commentsAtAnalysis.toLocaleString('pt-BR')}</strong>
            comentários
          </span>
          {opportunity.baselineComparison > 0 && (
            <span className="flex items-center gap-1.5 text-orange-400">
              <TrendingUp className="w-4 h-4" />
              <strong>+{Math.round(opportunity.baselineComparison)}%</strong>
              acima do esperado
            </span>
          )}
          <a
            href={opportunity.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline ml-auto"
          >
            Ver publicação <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Por que está em alta */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Por que está em alta
          </p>
          <p className="text-foreground">{opportunity.whyTrending}</p>
        </CardContent>
      </Card>

      {/* Pautas sugeridas — destaque */}
      {opportunity.storyIdeas.length > 0 && (
        <Section icon={<Lightbulb className="w-4 h-4 text-primary" />} title="Pautas sugeridas">
          <div className="space-y-3">
            {opportunity.storyIdeas.map((idea, i) => (
              <StoryIdeaCard key={i} idea={idea} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Clusters de discussão */}
      {opportunity.clusters.length > 0 && (
        <Section icon={<MessageCircle className="w-4 h-4" />} title="O que as pessoas estão discutindo">
          <div className="space-y-4">
            {opportunity.clusters.map((c, i) => (
              <ClusterBar key={i} cluster={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Alegações a verificar */}
      {opportunity.claimsToVerify.length > 0 && (
        <Section icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} title="Alegações que precisam de verificação">
          <div className="space-y-2">
            {opportunity.claimsToVerify.map((c, i) => (
              <ClaimCard key={i} claim={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Perguntas da audiência */}
      {opportunity.audienceQuestions.length > 0 && (
        <Section icon={<HelpCircle className="w-4 h-4" />} title="O que a audiência quer saber">
          <StringList items={opportunity.audienceQuestions} emptyMessage="Nenhuma pergunta identificada." />
        </Section>
      )}

      {/* Relatos */}
      {opportunity.reports.length > 0 && (
        <Section icon={<FileText className="w-4 h-4" />} title="Relatos de testemunhas">
          <StringList items={opportunity.reports} emptyMessage="Nenhum relato identificado." />
        </Section>
      )}

      {/* Reclamações */}
      {opportunity.complaints.length > 0 && (
        <Section icon={<Megaphone className="w-4 h-4" />} title="Principais reclamações">
          <StringList items={opportunity.complaints} emptyMessage="Nenhuma reclamação identificada." />
        </Section>
      )}

      {/* Sinais editoriais */}
      {opportunity.editorialSignals.length > 0 && (
        <Section icon={<Zap className="w-4 h-4 text-primary" />} title="Sinais editoriais">
          <StringList items={opportunity.editorialSignals} emptyMessage="Nenhum sinal identificado." />
        </Section>
      )}

      {/* Feedback */}
      {user && (
        <Card>
          <CardContent className="p-5">
            <FeedbackBar opportunityId={opportunity.id} userId={user.uid} />
          </CardContent>
        </Card>
      )}

      {/* Confiança */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        Confiança da análise: <strong className="text-foreground">
          {Math.round(opportunity.analysisConfidence * 100)}%
        </strong>
        {' · '}
        Potencial editorial: <strong className="text-foreground">
          {opportunity.editorialPotential}/100
        </strong>
      </div>
    </div>
  )
}
