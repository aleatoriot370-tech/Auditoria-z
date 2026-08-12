'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Save, X, Loader2, Trash2, Edit2, UserPlus, Filter,
} from 'lucide-react'
import { toast } from 'sonner'

interface UserRow {
  id_user: number
  Login: string | null
  Tipo: string | null
  Nome: string | null
  Status: string | null
  created_at?: string | null
}

const TIPOS = ['Users', 'Comercial', 'Admin Senior', 'Admin Junior'] as const
const TIPO_LABELS: Record<string, string> = {
  'Users': 'Users (Vendedor)',
  'Comercial': 'Comercial (Gestor)',
  'Admin Senior': 'Admin Senior',
  'Admin Junior': 'Admin Junior',
}

const STATUS_LABELS: Record<string, string> = {
  'a': 'Ativo',
  'i': 'Inativo',
}

export function Usuarios() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [filterTipo, setFilterTipo] = useState('')

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formLogin, setFormLogin] = useState('')
  const [formSenha, setFormSenha] = useState('')
  const [formTipo, setFormTipo] = useState('Users')
  const [formNome, setFormNome] = useState('')
  const [formStatus, setFormStatus] = useState('a')
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTipo) params.set('tipos', filterTipo)
      const r = await fetch('/api/users/manage?' + params.toString())
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.erro || 'Falha ao carregar usuários')
      }
      const d = await r.json()
      setUsers(d.users ?? [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [filterTipo])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function resetForm() {
    setEditingId(null)
    setFormLogin('')
    setFormSenha('')
    setFormTipo('Users')
    setFormNome('')
    setFormStatus('a')
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id_user)
    setFormLogin(user.Login ?? '')
    setFormSenha('')  // don't prefill password — user enters new one if they want to change
    setFormTipo(user.Tipo ?? 'Users')
    setFormNome(user.Nome ?? '')
    setFormStatus(user.Status ?? 'a')
    // Scroll to top so the form is visible
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!formLogin || !formTipo || !formNome || !formStatus) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    // For new user, senha is required
    if (!editingId && !formSenha) {
      toast.error('Senha é obrigatória para novos usuários.')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        Login: formLogin.trim(),
        Tipo: formTipo,
        Nome: formNome.trim(),
        Status: formStatus,
      }
      if (formSenha) {
        payload.Senha = formSenha
      }

      if (editingId) {
        // Update existing
        const r = await fetch(`/api/users/manage/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (!r.ok) {
          toast.error(d.erro || 'Falha ao atualizar usuário')
          return
        }
        toast.success(`Usuário "${formNome}" atualizado com sucesso!`)
      } else {
        // Create new
        payload.Senha = formSenha  // required for new user
        const r = await fetch('/api/users/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (!r.ok) {
          toast.error(d.erro || 'Falha ao criar usuário')
          return
        }
        toast.success(`Usuário "${formNome}" criado com sucesso!`)
      }
      resetForm()
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(user: UserRow) {
    if (!confirm(`Excluir o usuário "${user.Nome}" (${user.Login})? Esta ação não pode ser desfeita.`)) return
    try {
      const r = await fetch(`/api/users/manage/${user.id_user}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.erro || 'Falha ao excluir usuário')
        return
      }
      toast.success(`Usuário "${user.Nome}" excluído.`)
      // If we were editing this user, reset form
      if (editingId === user.id_user) resetForm()
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir')
    }
  }

  const isEditing = editingId !== null

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Cadastre, edite e exclua usuários do sistema. Clique duas vezes em um usuário na lista para editá-lo.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Edit2 className="w-5 h-5 text-primary" />
          ) : (
            <UserPlus className="w-5 h-5 text-primary" />
          )}
          <h3 className="text-base font-semibold text-foreground">
            {isEditing ? `Editando usuário #${editingId}` : 'Cadastrar novo usuário'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Login</label>
            <input
              type="text"
              value={formLogin}
              onChange={(e) => setFormLogin(e.target.value)}
              placeholder="login.usuario"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
              Senha {isEditing && <span className="text-muted-foreground font-normal normal-case">(deixe vazio para manter)</span>}
            </label>
            <input
              type="password"
              value={formSenha}
              onChange={(e) => setFormSenha(e.target.value)}
              placeholder={isEditing ? '•••••••• (não alterar)' : '••••••••'}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Nome</label>
            <input
              type="text"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Nome completo"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Tipo</label>
            <select
              value={formTipo}
              onChange={(e) => setFormTipo(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="a">Ativo</option>
              <option value="i">Inativo</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-border">
          {isEditing && (
            <button
              onClick={resetForm}
              disabled={saving}
              className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          )}
          <button
            onClick={resetForm}
            disabled={saving}
            className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Usuário'}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-border bg-card p-4 card-shadow">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Filtrar por tipo</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-48"
            >
              <option value="">Todos os tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Usuários cadastrados</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {loading ? 'Carregando...' : `${users.length} usuário(s) encontrado(s). Dica: clique duas vezes em uma linha para editar.`}
          </p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando usuários...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Login</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr
                    key={u.id_user}
                    onDoubleClick={() => startEdit(u)}
                    className={`hover:bg-muted/30 cursor-pointer transition ${
                      editingId === u.id_user ? 'bg-primary/5' : ''
                    }`}
                    title="Duplo clique para editar"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums">{u.Login ?? '—'}</td>
                    <td className="px-4 py-3">{u.Nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {TIPO_LABELS[u.Tipo ?? ''] ?? u.Tipo ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        u.Status === 'a'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {STATUS_LABELS[u.Status ?? ''] ?? u.Status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(u)
                          }}
                          className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(u)
                          }}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
