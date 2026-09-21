import { useNavigate } from 'react-router-dom'
import { TrendingUp, MessageCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreBadge } from './ScoreBadge'
import { PlatformBadge } from './PlatformBadge'
import type { Opportunity } from '@/types/radar'

interface OpportunityCardProps {
  opportunity: Opportunity
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const navigate = useNavigate()

  const publishedAgo = formatDistanceToNow(opportunity.createdAt.toDate(), {
    addSuffix: true,
    locale: ptBR,
  })

  const topClusters = opportunity.clusters.slice(0, 3)

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all duration-200 group"
      onClick={() => navigate(`/radar/${opportunity.id}`)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ScoreBadge score={opportunity.trendScore} size="md" />
            <PlatformBadge platform={opportunity.platform} />
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {publishedAgo}
          </span>
        </div>

        {/* Topic */}
        <h3 className="font-bold text-foreground uppercase tracking-wide text-sm mb-1">
          {opportunity.mainTopic}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {opportunity.summary}
        </p>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            <strong className="text-foreground">{opportunity.commentsAtAnalysis.toLocaleString('pt-BR')}</strong>
            &nbsp;comentários
          </span>
          {opportunity.baselineComparison > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <TrendingUp className="w-3 h-3" />
              <strong>+{Math.round(opportunity.baselineComparison)}%</strong>
              &nbsp;acima do esperado
            </span>
          )}
        </div>

        {/* Clusters */}
        {topClusters.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Principal discussão:</p>
            <div className="flex flex-wrap gap-2">
              {topClusters.map((cluster, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs bg-secondary px-2 py-1 rounded-md"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-secondary-foreground">{cluster.topic}</span>
                  <span className="text-muted-foreground">{cluster.percentage}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Confiança: <strong className="text-foreground">{Math.round(opportunity.analysisConfidence * 100)}%</strong>
          </span>
          <span className="text-xs text-primary group-hover:underline">
            Ver análise →
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
