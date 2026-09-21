import { useState, useEffect } from 'react'
import { Radio, RefreshCw, SlidersHorizontal, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PostCard } from '@/components/radar/PostCard'
import { EmptyState } from '@/components/radar/EmptyState'
import { WordCloud } from '@/components/radar/WordCloud'
import { useRadar } from '@/hooks/useRadar'
import { getRecentCommentTexts } from '@/services/radar'
import type { PlatformFilter, TimeFilter, SortOption } from '@/types/radar'
import { cn } from '@/lib/utils'

const CLOUD_PERIODS: { value: number; label: string }[] = [
  { value: 1 * 60 * 60 * 1000, label: '1h' },
  { value: 3 * 60 * 60 * 1000, label: '3h' },
  { value: 6 * 60 * 60 * 1000, label: '6h' },
  { value: 12 * 60 * 60 * 1000, label: '12h' },
  { value: 24 * 60 * 60 * 1000, label: '24h' },
]

const PLATFORM_FILTERS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'imirante', label: 'Site' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
]

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'now', label: 'Última hora' },
  { value: '3h', label: 'Últimas 3h' },
  { value: '6h', label: 'Últimas 6h' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '3d', label: 'Últimos 3 dias' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'score', label: 'Maior score' },
  { value: 'recent', label: 'Mais recente' },
  { value: 'comments', label: 'Mais comentários' },
]

export default function Radar() {
  const { posts, filters, setFilters, loading, error, refresh } = useRadar()
  const [cloudPeriod, setCloudPeriod] = useState(CLOUD_PERIODS[1].value) // default 3h
  const [cloudTexts, setCloudTexts] = useState<string[]>([])
  const [cloudLoading, setCloudLoading] = useState(false)

  useEffect(() => {
    setCloudLoading(true)
    getRecentCommentTexts(Date.now() - cloudPeriod)
      .then(setCloudTexts)
      .catch(console.error)
      .finally(() => setCloudLoading(false))
  }, [cloudPeriod])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Radar</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {posts.length > 0
              ? `${posts.length} publicações monitoradas`
              : 'Inteligência de audiência em tempo real'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {PLATFORM_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilters((f) => ({ ...f, platform: value }))}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filters.platform === value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />

          {TIME_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilters((f) => ({ ...f, time: value }))}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                filters.time === value
                  ? 'bg-secondary text-foreground border-border'
                  : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}

          <span className="text-border">|</span>

          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilters((f) => ({ ...f, sort: value }))}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                filters.sort === value
                  ? 'bg-secondary text-foreground border-border'
                  : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Word cloud dos comentários recentes */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircle className="w-4 h-4" />
              O que o público está comentando
            </div>
            <div className="flex items-center gap-1.5">
              {CLOUD_PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setCloudPeriod(value)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                    cloudPeriod === value
                      ? 'bg-secondary text-foreground border-border'
                      : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <WordCloud texts={cloudTexts} loading={cloudLoading} />
        </CardContent>
      </Card>

      {/* Content */}
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
