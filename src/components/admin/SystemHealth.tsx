import { useState, useEffect, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getSystemHealth } from '@/services/admin'
import type { SystemHealthEntry } from '@/types/admin'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'

function fmtDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtAgo(ts?: Timestamp): string {
  if (!ts) return 'Nunca'
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR })
  } catch {
    return '—'
  }
}

export function SystemHealth() {
  const [entries, setEntries] = useState<SystemHealthEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await getSystemHealth())
    } catch (err) {
      console.error('[SystemHealth]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground/70" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saúde do Sistema</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-card border border-border/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const isOk      = entry.lastStatus === 'success'
            const isNever   = entry.lastStatus === 'never'
            const isError   = entry.lastStatus === 'error'

            return (
              <Card key={entry.id} className={cn(
                'border transition-colors',
                isError   ? 'border-destructive/30 bg-destructive/5' :
                isNever   ? 'border-border/50'  :
                            'border-border/60',
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOk    && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      {isError && <XCircle      className="w-4 h-4 text-destructive flex-shrink-0" />}
                      {isNever && <Clock        className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{entry.label}</p>
                        {isNever ? (
                          <p className="text-xs text-muted-foreground/50 mt-0.5">Nunca executado</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Última execução: {fmtAgo(entry.lastRun as Timestamp | undefined)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 space-y-0.5">
                      {!isNever && (
                        <>
                          <p className="text-[10px] text-muted-foreground/50">
                            {entry.runCount ?? 0} execuções · {fmtDuration(entry.lastDurationMs)}
                          </p>
                          {isError && entry.consecutiveErrors > 0 && (
                            <p className="text-[10px] text-destructive font-semibold">
                              {entry.consecutiveErrors} erro{entry.consecutiveErrors > 1 ? 's' : ''} consecutivo{entry.consecutiveErrors > 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {isError && entry.lastError && (
                    <div className="mt-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
                      <p className="text-[11px] text-destructive/80 font-mono break-all leading-relaxed">
                        {entry.lastError}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
