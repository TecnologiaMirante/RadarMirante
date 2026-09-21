import { useState, useEffect, useCallback } from 'react'
import { KeyRound, Plus, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { getCredentials, deleteCredential } from '@/services/credentials'
import type { Credential } from '@/types/credentials'

interface Props {
  isAdmin: boolean
}

export function CredentialVault({ isAdmin }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Credential | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Credential | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getCredentials()
      setCredentials(data)
    } catch (err) {
      console.error('[CredentialVault]', err)
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(c: Credential) { setEditing(c); setFormOpen(true) }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deleteCredential(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    } catch (err) {
      console.error('[CredentialVault] delete', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-muted-foreground/70" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cofre de Acessos</p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground/50">
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-destructive">Erro ao carregar credenciais</p>
              <p className="text-[11px] text-destructive/70 mt-0.5 break-words">{loadError}</p>
            </div>
          </div>
          <button onClick={load}
            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline">
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center">
          <KeyRound className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/50">Nenhum acesso cadastrado</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground/40 mt-1">
              Clique em "Adicionar" para cadastrar o primeiro acesso.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map(c => (
            <CredentialCard
              key={c.id}
              credential={c}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}

      <CredentialForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Remover acesso</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tem certeza que deseja remover <strong>{confirmDelete.name}</strong>?
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
