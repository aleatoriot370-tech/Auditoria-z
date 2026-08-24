'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Search, History } from 'lucide-react'
import { toast } from 'sonner'

interface LogRow {
  id_log: number
  id_user: number | null
  login: string | null
  ip: string | null
  user_agent: string | null
  data_hora: string
}

export function LogAcesso() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [busca, setBusca] = useState('')
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/logs-acesso?limit=500')
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.erro || 'Falha ao carregar acessos')
      }
      const d = await r.json()
      setLogs(d.logs ?? [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar acessos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const usuarios = useMemo(() => {
    const set = new Set<string>()
    for (const l of logs) {
      if (l.login) set.add(l.login)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [logs])

  const filtered = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const de = dataDe ? new Date(dataDe + 'T00:00:00') : null
    const ate = dataAte ? new Date(dataAte + 'T23:59:59') : null
    return logs.filter((l) => {
      if (usuarioFiltro && l.login !== usuarioFiltro) return false
      if (termo && !(
        (l.login ?? '').toLowerCase().includes(termo) ||
        (l.ip ?? '').toLowerCase().includes(termo)
      )) return false
      const quando = new Date(l.data_hora)
      if (de && quando < de) return false
      if (ate && quando > ate) return false
      return true
    })
  }, [logs, busca, usuarioFiltro, dataDe, dataAte])

  function limparFiltros() {
    setBusca('')
    setUsuarioFiltro('')
    setDataDe('')
    setDataAte('')
  }

  function formatarData(iso: string) {
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
    } catch {
      return iso
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Histórico de logins no sistema — data, horário, IP e navegador de cada acesso.
        </p>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-border bg-card p-4 card-shadow">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
              Usuário / Pessoa
            </label>
            <select
              value={usuarioFiltro}
              onChange={(e) => setUsuarioFiltro(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-48"
            >
              <option value="">Todos os usuários</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
              De
            </label>
            <input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
              Até
            </label>
            <input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2 flex-1 min-w-48">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
              Buscar por login ou IP
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="ex: bruno"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {(busca || usuarioFiltro || dataDe || dataAte) && (
            <button
              onClick={limparFiltros}
              className="h-10 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Logs list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Histórico de acessos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? 'Carregando...' : `${filtered.length} acesso(s) encontrado(s) (últimos 500 registros).`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando acessos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum acesso encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Login</th>
                  <th className="px-4 py-3 font-medium">Data/Hora</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Navegador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <tr key={l.id_log} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">{l.login ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{formatarData(l.data_hora)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs" title={l.user_agent ?? ''}>
                      {l.user_agent ?? '—'}
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
