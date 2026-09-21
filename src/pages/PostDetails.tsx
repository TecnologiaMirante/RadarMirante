import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Heart, Share2, Eye,
  Clock, Sparkles, FileText, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, TrendingUp, Zap, Users,
  CheckCircle2, HelpCircle, BookOpen, ArrowUpRight,
} from 'lucide-react'
import { InfoTip } from '@/components/ui/InfoTip'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreBadge } from '@/components/radar/ScoreBadge'
import { PlatformBadge } from '@/components/radar/PlatformBadge'
import {
  getPost, getPostOpportunity, submitFeedback,
  triggerPostAnalysis, getPostComments,
} from '@/services/radar'
import { useAuth } from '@/hooks/useAuth'
import type {
  RadarPost, Opportunity, RadarComment, StoryIdea,
  TopicCluster, ClaimToVerify,
} from '@/types/radar'
import { cn } from '@/lib/utils'

// ─── Small helpers ────────────────────────────────────────────────────────────

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <strong className="text-foreground tabular-nums">{value}</strong>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
}

function ClusterBar({ cluster }: { cluster: TopicCluster }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground font-medium">{cluster.topic}</span>
        <span className="text-xs font-semibold text-primary">{cluster.percentage}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${cluster.percentage}%` }} />
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

const PRIORITY_STYLES = {
  high:   { border: 'border-l-orange-400',  badge: 'bg-orange-400/10 text-orange-400',   label: 'URGENTE'   },
  medium: { border: 'border-l-primary',     badge: 'bg-primary/10 text-primary',         label: 'RELEVANTE' },
  low:    { border: 'border-l-border',      badge: 'bg-secondary text-muted-foreground', label: 'MONITORE'  },
}

function StoryIdeaCard({ idea, index }: { idea: StoryIdea; index: number }) {
  const s = PRIORITY_STYLES[idea.priority]
  const [open, setOpen] = useState(index === 0)

  return (
    <div className={cn('rounded-lg border border-l-4 bg-card overflow-hidden', s.border)}>
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded', s.badge)}>{s.label}</span>
            <span className="text-xs text-muted-foreground">Pauta {index + 1}</span>
          </div>
          <p className="font-bold text-foreground leading-snug text-sm">{idea.headline}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">{idea.angle}</p>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Por que agora: </strong>{idea.whyNow}
          </p>
          {idea.questionsToAnswer.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">O que investigar</p>
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
    return <p className="text-xs text-muted-foreground text-center py-2">{sent ? '👍 Obrigado pelo feedback!' : '👎 Feedback registrado.'}</p>
  }
  return (
    <div className="flex items-center justify-center gap-3">
      <p className="text-xs text-muted-foreground">Esta análise foi útil?</p>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void send(true)} disabled={loading}>👍 Sim</Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void send(false)} disabled={loading}>👎 Não</Button>
    </div>
  )
}

// ─── Copiloto Sidebar Panel ───────────────────────────────────────────────────

function CopilotoPanel({
  opportunity, analyzing, analyzeError, onAnalyze, userId, postId,
}: {
  opportunity: Opportunity | null
  analyzing: boolean
  analyzeError: string | null
  onAnalyze: () => void
  userId: string
  postId: string
}) {
  void postId

  if (!opportunity && !analyzing) {
    return (
      <div className="space-y-3">
        <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="p-5 space-y-4 text-center">
            <div className="w-11 h-11 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Copiloto editorial</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Gere pautas, descubra o que a audiência quer saber e identifique alegações para verificar.
              </p>
            </div>
            {analyzeError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{analyzeError}</p>
            )}
            <Button onClick={onAnalyze} disabled={analyzing} className="w-full gap-2 h-9">
              <Sparkles className="w-3.5 h-3.5" />
              Analisar com IA
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (analyzing) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
          <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div>
            <p className="text-sm font-semibold text-foreground">Analisando…</p>
            <p className="text-xs text-muted-foreground mt-0.5">A IA está lendo os comentários e gerando pautas.</p>
          </div>
          <p className="text-[10px] text-muted-foreground/60 animate-pulse">Isso pode levar até 1 minuto</p>
        </CardContent>
      </Card>
    )
  }

  if (!opportunity) return null

  const highIdeas  = opportunity.storyIdeas?.filter(i => i.priority === 'high').length ?? 0
  const totalIdeas = opportunity.storyIdeas?.length ?? 0

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">Copiloto</span>
          <span className="text-[10px] text-muted-foreground/60">IA editorial</span>
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Atualizar análise"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Main topic + why trending */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Tópico principal</p>
            <p className="font-bold text-foreground text-sm leading-snug">{opportunity.mainTopic}</p>
          </div>
          {opportunity.whyTrending && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2.5">
              {opportunity.whyTrending}
            </p>
          )}
          {/* Editorial potential */}
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/60">Potencial editorial</span>
              <span className={cn('font-bold',
                opportunity.editorialPotential >= 75 ? 'text-green-400' :
                opportunity.editorialPotential >= 50 ? 'text-primary' : 'text-yellow-400'
              )}>
                {opportunity.editorialPotential}/100
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  opportunity.editorialPotential >= 75 ? 'bg-green-400' :
                  opportunity.editorialPotential >= 50 ? 'bg-primary' : 'bg-yellow-400'
                )}
                style={{ width: `${opportunity.editorialPotential}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 pt-0.5">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" />
              Score: <strong className="text-foreground ml-0.5">{opportunity.trendScore}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />
              Confiança: <strong className="text-foreground ml-0.5">{Math.round(opportunity.analysisConfidence * 100)}%</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Story ideas — compact */}
      {totalIdeas > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                Pautas sugeridas
              </p>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                {totalIdeas}
                {highIdeas > 0 && <span className="ml-1 text-orange-400">{highIdeas} urg.</span>}
              </span>
            </div>
            <div className="space-y-2.5">
              {opportunity.storyIdeas.slice(0, 4).map((idea, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap',
                    idea.priority === 'high'   ? 'bg-orange-500/15 text-orange-400' :
                    idea.priority === 'medium' ? 'bg-primary/10 text-primary' :
                    'bg-secondary text-muted-foreground'
                  )}>
                    {idea.priority === 'high' ? 'URG.' : idea.priority === 'medium' ? 'REL.' : 'MON.'}
                  </span>
                  <p className="text-xs text-foreground leading-snug">{idea.headline}</p>
                </div>
              ))}
              {totalIdeas > 4 && (
                <p className="text-[10px] text-muted-foreground/50">+{totalIdeas - 4} pautas na aba Análise</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audience questions */}
      {(opportunity.audienceQuestions?.length ?? 0) > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-3 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              Audiência pergunta
            </p>
            <ul className="space-y-1.5">
              {opportunity.audienceQuestions.slice(0, 4).map((q, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5 leading-relaxed">
                  <span className="text-primary flex-shrink-0 font-bold mt-0.5 text-[10px]">?</span>{q}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Claims */}
      {(opportunity.claimsToVerify?.length ?? 0) > 0 && (
        <Card className="border-orange-500/20 bg-orange-500/3">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-orange-400" />
              <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">
                Verificar ({opportunity.claimsToVerify.length})
              </p>
            </div>
            <ul className="space-y-1">
              {opportunity.claimsToVerify.slice(0, 2).map((c, i) => (
                <li key={i} className="text-[11px] text-foreground/80 leading-relaxed line-clamp-2">
                  "{c.claim}"
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      <div className="pt-1">
        <FeedbackBar opportunityId={opportunity.id} userId={userId} />
      </div>
    </div>
  )
}

// ─── Tab: Comentários ─────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#6366f1','#8b5cf6','#ec4899','#06b6d4',
  '#10b981','#f59e0b','#f97316','#3b82f6',
]

function avatarColor(authorHash: string): string {
  let h = 0
  for (let i = 0; i < authorHash.length; i++) h = (h * 31 + authorHash.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function avatarInitials(authorHash: string): string {
  return authorHash.slice(0, 2).toUpperCase()
}

function resolveDate(publishedAt: RadarComment['publishedAt']): Date | null {
  try {
    return publishedAt.toDate()
  } catch {
    return null
  }
}

function CommentsTab({ comments, loading }: { comments: RadarComment[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const PAGE = 20
  const visible = showAll ? comments : comments.slice(0, PAGE)

  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-border/50 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3.5 px-1">
            <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <MessageCircle className="w-8 h-8 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/60">Nenhum comentário coletado ainda.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest px-1 pb-2">
        {comments.length} comentário{comments.length !== 1 ? 's' : ''}
      </p>

      <div className="divide-y divide-border/40">
        {visible.map((c) => {
          const bg = avatarColor(c.authorHash ?? c.id)
          const initials = avatarInitials(c.authorHash ?? c.id)
          const date = resolveDate(c.publishedAt)
          const timeAgo = date
            ? formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
            : null

          return (
            <div key={c.id} className="flex gap-3 py-3 px-1 group">
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                style={{ backgroundColor: bg }}
              >
                {initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">{c.text}</p>
                <div className="flex items-center gap-2.5 mt-1">
                  {timeAgo && (
                    <span className="text-[11px] text-muted-foreground/50">{timeAgo}</span>
                  )}
                  {c.likeCount != null && c.likeCount > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                      <Heart className="w-3 h-3" />
                      {c.likeCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {comments.length > PAGE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-2.5 flex items-center justify-center gap-1.5 transition-colors border-t border-border/40"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Ver mais {comments.length - PAGE} comentários</>}
        </button>
      )}
    </div>
  )
}

// ─── Tab: Análise editorial ───────────────────────────────────────────────────

function AnalysisTab({
  opportunity, postId, analyzing, analyzeError, onAnalyze, userId,
}: {
  opportunity: Opportunity | null
  postId: string
  analyzing: boolean
  analyzeError: string | null
  onAnalyze: () => void
  userId: string
}) {
  void postId

  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-5 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-background animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <p className="font-bold text-foreground text-base">Sem análise editorial</p>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Gere uma análise com IA para descobrir pautas, o que a audiência discute e alegações para checar.
          </p>
        </div>
        {analyzeError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{analyzeError}</p>
        )}
        <Button onClick={onAnalyze} disabled={analyzing} size="lg" className="gap-2 font-semibold">
          <Sparkles className="w-4 h-4" />
          {analyzing ? 'Analisando com IA…' : 'Analisar agora'}
        </Button>
        {analyzing && (
          <p className="text-xs text-muted-foreground animate-pulse">Isso pode levar até 1 minuto…</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Resumo */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tópico principal</p>
        </div>
        <p className="font-bold text-foreground text-lg leading-snug">{opportunity.mainTopic}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.summary}</p>
        {opportunity.whyTrending && (
          <p className="text-sm text-foreground border-l-2 border-primary pl-3 mt-2">
            <strong className="font-semibold">Por que está em alta: </strong>{opportunity.whyTrending}
          </p>
        )}
      </div>

      {/* Clusters */}
      {opportunity.clusters?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">O que as pessoas discutem</p>
            <InfoTip side="right">
              <p className="font-semibold text-foreground mb-1.5">Clusters temáticos</p>
              <p className="text-muted-foreground">
                A IA agrupa os comentários por temas e calcula a proporção de cada um.
              </p>
            </InfoTip>
          </div>
          <div className="space-y-4">
            {opportunity.clusters.map((cluster: TopicCluster, i: number) => <ClusterBar key={i} cluster={cluster} />)}
          </div>
        </div>
      )}

      {/* Pautas */}
      {opportunity.storyIdeas?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground/70" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pautas sugeridas</p>
            <InfoTip side="right">
              <p className="font-semibold text-foreground mb-1.5">Pautas sugeridas pela IA</p>
              <p className="text-muted-foreground mb-2">Cada pauta inclui título, ângulo jornalístico, fontes e perguntas a investigar.</p>
              <div className="space-y-1 text-muted-foreground">
                <p><strong className="text-foreground">URGENTE</strong> — Alta relevância ou janela de tempo curta.</p>
                <p><strong className="text-foreground">RELEVANTE</strong> — Bom potencial editorial.</p>
                <p><strong className="text-foreground">MONITORE</strong> — Vale acompanhar.</p>
              </div>
            </InfoTip>
          </div>
          <div className="space-y-2">
            {opportunity.storyIdeas.map((idea: StoryIdea, i: number) => <StoryIdeaCard key={i} idea={idea} index={i} />)}
          </div>
        </div>
      )}

      {/* Perguntas da audiência */}
      {opportunity.audienceQuestions?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">O que a audiência quer saber</p>
          </div>
          <ul className="space-y-1.5">
            {opportunity.audienceQuestions.map((q: string, i: number) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary flex-shrink-0 mt-0.5 font-bold">?</span>{q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Claims */}
      {opportunity.claimsToVerify?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400/80" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alegações para verificar</p>
            <InfoTip side="right">
              <p className="font-semibold text-foreground mb-1.5">Alegações para verificar</p>
              <p className="text-muted-foreground">Afirmações dos comentários que podem precisar de checagem jornalística.</p>
            </InfoTip>
          </div>
          <div className="space-y-2">
            {opportunity.claimsToVerify.map((c: ClaimToVerify, i: number) => <ClaimCard key={i} claim={c} />)}
          </div>
        </div>
      )}

      {/* Relatos + Reclamações */}
      {(opportunity.reports?.length > 0 || opportunity.complaints?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {opportunity.reports?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Relatos de testemunhas</p>
              <ul className="space-y-1">
                {opportunity.reports.map((e: string, i: number) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground flex-shrink-0">•</span>{e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {opportunity.complaints?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Principais reclamações</p>
              <ul className="space-y-1">
                {opportunity.complaints.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground flex-shrink-0">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sinais editoriais */}
      {opportunity.editorialSignals?.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary/70" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sinais editoriais</p>
          </div>
          <ul className="space-y-1">
            {opportunity.editorialSignals.map((s: string, i: number) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-primary flex-shrink-0">⚡</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rodapé */}
      <div className="pt-3 border-t border-border space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400/70" />
          <span>
            Confiança: <strong className="text-foreground">{Math.round(opportunity.analysisConfidence * 100)}%</strong>
            {' · '}
            Potencial: <strong className="text-foreground">{opportunity.editorialPotential}/100</strong>
          </span>
        </div>
        <FeedbackBar opportunityId={opportunity.id} userId={userId} />
      </div>
    </div>
  )
}

// ─── Post Header ──────────────────────────────────────────────────────────────

function PostHeader({ post, publishedAgo }: { post: RadarPost; publishedAgo: string }) {
  const statusConfig: Record<string, { label: string; class: string }> = {
    trending:   { label: 'Repercutindo',  class: 'bg-red-500/15 text-red-400 border-red-500/30' },
    candidate:  { label: 'Aquecendo',     class: 'bg-primary/10 text-primary border-primary/20' },
    monitoring: { label: 'Monitorando',   class: 'bg-secondary text-muted-foreground border-border' },
    analyzed:   { label: 'Analisado',     class: 'bg-green-500/10 text-green-400 border-green-500/20' },
    archived:   { label: 'Arquivado',     class: 'bg-secondary text-muted-foreground/60 border-border' },
  }
  const s = statusConfig[post.status] ?? statusConfig.monitoring

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-5 space-y-4">

        {/* Top row: platform + status + time */}
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformBadge platform={post.platform} />
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', s.class)}>
            {s.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />{publishedAgo}
          </span>
        </div>

        {/* Post text */}
        {post.text && (
          <p className="text-sm text-foreground leading-relaxed line-clamp-5 border-l-2 border-border/60 pl-3">
            {post.text}
          </p>
        )}

        {/* Metrics + score row */}
        <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-border/40">
          <ScoreBadge score={post.trendScore} size="lg" showInfo />
          <div className="h-4 w-px bg-border/60" />
          <Metric icon={<MessageCircle className="w-3.5 h-3.5" />}
            value={post.metrics.comments.toLocaleString('pt-BR')} label="comentários" />
          <Metric icon={<Heart className="w-3.5 h-3.5" />}
            value={post.metrics.likes.toLocaleString('pt-BR')} label="curtidas" />
          {post.metrics.shares > 0 && (
            <Metric icon={<Share2 className="w-3.5 h-3.5" />}
              value={post.metrics.shares.toLocaleString('pt-BR')} label="compartilhamentos" />
          )}
          {(post.metrics.views ?? 0) > 0 && (
            <Metric icon={<Eye className="w-3.5 h-3.5" />}
              value={(post.metrics.views ?? 0).toLocaleString('pt-BR')} label="visualizações" />
          )}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
          >
            Ver publicação <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'analysis' | 'comments'

export default function PostDetails() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [post, setPost] = useState<RadarPost | null>(null)
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [comments, setComments] = useState<RadarComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('analysis')

  useEffect(() => {
    if (!postId) return
    Promise.all([getPost(postId), getPostOpportunity(postId)])
      .then(([p, o]) => { setPost(p); setOpportunity(o) })
      .catch(console.error)
      .finally(() => setLoading(false))

    getPostComments(postId, 200)
      .then(setComments)
      .catch(console.error)
      .finally(() => setCommentsLoading(false))
  }, [postId])

  async function handleAnalyze() {
    if (!postId || analyzing) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      await triggerPostAnalysis(postId)
      const [p, o] = await Promise.all([getPost(postId), getPostOpportunity(postId)])
      setPost(p); setOpportunity(o)
      setTab('analysis')
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro ao analisar')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-40 bg-card rounded" />
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-4">
            <div className="h-36 bg-card rounded-xl" />
            <div className="h-10 bg-card rounded" />
            <div className="h-64 bg-card rounded-xl" />
          </div>
          <div className="h-80 bg-card rounded-xl" />
        </div>
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
    <div className="space-y-4">

      {/* Back */}
      <Button
        variant="ghost" size="sm"
        onClick={() => navigate(-1)}
        className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Radar
      </Button>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: post content ── */}
        <div className="space-y-4">
          <PostHeader post={post} publishedAgo={publishedAgo} />

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab('analysis')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === 'analysis'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <FileText className="w-4 h-4" />
              Análise editorial
              {opportunity && (
                <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">✓</span>
              )}
            </button>
            <button
              onClick={() => setTab('comments')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === 'comments'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <MessageCircle className="w-4 h-4" />
              Comentários
              {comments.length > 0 && (
                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">{comments.length}</span>
              )}
            </button>
          </div>

          <div className="pb-10">
            {tab === 'comments' && (
              <CommentsTab comments={comments} loading={commentsLoading} />
            )}
            {tab === 'analysis' && (
              <AnalysisTab
                opportunity={opportunity}
                postId={postId ?? ''}
                analyzing={analyzing}
                analyzeError={analyzeError}
                onAnalyze={() => void handleAnalyze()}
                userId={user?.uid ?? ''}
              />
            )}
          </div>
        </div>

        {/* ── Right: Copiloto sticky panel ── */}
        <div className="xl:sticky xl:top-4">
          <CopilotoPanel
            opportunity={opportunity}
            analyzing={analyzing}
            analyzeError={analyzeError}
            onAnalyze={() => void handleAnalyze()}
            userId={user?.uid ?? ''}
            postId={postId ?? ''}
          />
        </div>

      </div>
    </div>
  )
}
