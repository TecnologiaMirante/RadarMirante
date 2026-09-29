import { useState, useEffect, useCallback } from 'react'
import { ScrollText, RefreshCw } from 'lucide-react'
import { getAuditLog } from '@/services/admin'
import type { AuditLogEntry } from '@/types/admin'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_created:        { label: 'Novo usuário',          color: 'bg-green-500/10 text-green-400' },
  user_disabled:       { label: 'Usuário desativado',    color: 'bg-destructive/10 text-destructive' },
  user_enabled:        { label: 'Usuário reativado',     color: 'bg-green-500/10 text-green-400' },
  role_changed:        { label: 'Papel alterado',        color: 'bg-primary/10 text-primary' },
  accounts_changed:    { label: 'Acessos alterados',     color: 'bg-primary/10 text-primary' },
  invite_created:      { label: 'Convite enviado',       color: 'bg-yellow-500/10 text-yellow-400' },
  invite_deleted:      { label: 'Convite removido',      color: 'bg-secondary text-muted-foreground' },
  credential_accessed: { label: 'Senha revelada',        color: 'bg-orange-500/10 text-orange-400' },
  credential_created:  { label: 'Acesso cadastrado',     color: 'bg-green-500/10 text-green-400' },
  credential_deleted:  { label: 'Acesso removido',       color: 'bg-destructive/10 text-destructive' },
  analysis_triggered:  { label: 'Análise iniciada',      color: 'bg-primary/10 text-primary' },
}

function fmtAgo(ts?: Timestamp): string {
  if (!ts) return '—'
  try { return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

function detailLine(entry: AuditLogEntry): string | null {
  const d = entry.details
  if (!d) return null
  if (entry.action === 'role_changed') return `${d.from} → ${d.to}`
  if (entry.action === 'accounts_changed') return `${(d.to as string[])?.join(', ') ?? '—'}`
  if (entry.action === 'invite_created' || entry.action === 'invite_deleted') return String(d.email ?? '')
  return null
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setEntries(await getAuditLog(80)) }
    catch (err) { console.error('[AuditLog]', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-3.5 h-3.5 text-muted-foreground/70" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Log de Atividades</p>
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-card border border-border/60 rounded-lg animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground/50">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-1 divide-y divide-border/30">
          {entries.map(entry => {
            const cfg     = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'bg-secondary text-muted-foreground' }
            const detail  = detailLine(entry)
            const target  = entry.targetEmail ?? entry.targetUid

            return (
              <div key={entry.id} className="flex items-start gap-3 py-2.5 px-1">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap', cfg.color)}>
                  {cfg.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground/80 truncate leading-tight">
                    <span className="font-medium">{entry.performedByEmail}</span>
                    {target && target !== entry.performedByEmail && (
                      <span className="text-muted-foreground"> → {target}</span>
                    )}
                  </p>
                  {detail && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{detail}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 whitespace-nowrap">
                  {fmtAgo(entry.createdAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
