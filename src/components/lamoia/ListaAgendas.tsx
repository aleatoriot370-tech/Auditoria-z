'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Loader2, Eye, Trash2, X, Plus, Save, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface Agenda {
  id_agenda: number
  data_agenda: string | null
  mes_referencia: string | null
  status_atual: string | null
  placa: string | null
  total_visitas?: number
  gerente?: { Nome: string | null } | null
  vendedor?: { Nome: string | null } | null
}

interface ListResponse {
  agendas: Agenda[]
  gestores: { id_user: number; Nome: string | null }[]
  vendedores: { id_user: number; Nome: string | null }[]
  isComercial: boolean
  canDelete: boolean
}

interface DetailData {
  agenda: Agenda & {
    hora_inicial?: string | null
    hora_fim?: string | null
    total_hora?: string | null
    eficiencia?: number | null
    obs_geral?: string | null
    data_aud?: string | null
  }
  visitas: {
    id_ad: number
    id_clientes: number | null
    status_atendimento: string | null
    cliente?: { Razao: string | null; Bairro: string | null; Cidade: string | null; UF: string | null } | null
  }[]
  canEdit: boolean
}

export function ListaAgendas() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ListResponse | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Filters
  const [filterTipo, setFilterTipo] = useState<'data' | 'mes_referencia'>('data')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  })
  const [idGestor, setIdGestor] = useState('')
  const [idVendedor, setIdVendedor] = useState('')

  // Detail popup
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addingCodigo, setAddingCodigo] = useState('')
  const [keepIds, setKeepIds] = useState<Set<number>>(new Set())
  const [savingDetail, setSavingDetail] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('tipo', filterTipo)
      if (filterTipo === 'data') {
        if (dataInicio) params.set('data_inicio', dataInicio)
        if (dataFim) params.set('data_fim', dataFim)
      } else {
        params.set('mes_referencia', mesReferencia)
      }
      if (idGestor) params.set('id_gerente', idGestor)
      if (idVendedor) params.set('id_vendedor', idVendedor)

      const r = await fetch('/api/agenda/list?' + params.toString())
      if (!r.ok) throw new Error('Falha ao carregar')
      const d = await r.json()
      setData(d)
      setSelected(new Set())
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar agendas')
    } finally {
      setLoading(false)
    }
  }, [filterTipo, dataInicio, dataFim, mesReferencia, idGestor, idVendedor])

  useEffect(() => {
    loadList()
  }, [loadList])

  async function openDetail(id: number) {
    setDetailId(id)
    setLoadingDetail(true)
    setAddingCodigo('')
    setKeepIds(new Set())
    try {
      const r = await fetch(`/api/agenda/${id}`)
      if (!r.ok) throw new Error('Falha ao carregar detalhe')
      const d = await r.json()
      setDetail(d)
      setKeepIds(new Set(d.visitas.map((v) => v.id_ad)))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao abrir detalhe')
    } finally {
      setLoadingDetail(false)
    }
  }

  function toggleKeep(id_ad: number) {
    setKeepIds((prev) => {
      const next = new Set(prev)
      if (next.has(id_ad)) next.delete(id_ad)
      else next.add(id_ad)
      return next
    })
  }

  async function saveDetail() {
    if (!detail || !detailId) return
    setSavingDetail(true)
    try {
      const addCodigos: number[] = []
      if (addingCodigo) {
        const cod = Number(addingCodigo)
        if (!Number.isFinite(cod) || cod <= 0) {
          toast.error('Código inválido.')
          setSavingDetail(false)
          return
        }
        addCodigos.push(cod)
      }
      const r = await fetch(`/api/agenda/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keep_visit_ids: Array.from(keepIds),
          add_codigos: addCodigos,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.erro || 'Falha ao salvar')
        return
      }
      toast.success('Agenda atualizada!')
      setDetail(null)
      setDetailId(null)
      loadList()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) {
      toast.info('Selecione ao menos uma agenda.')
      return
    }
    if (!confirm(`Excluir ${selected.size} agenda(s)? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    try {
      const r = await fetch('/api/agenda/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.erro || 'Falha ao excluir')
        return
      }
      toast.success(`${d.excluidas} agenda(s) excluída(s).`)
      loadList()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canDelete = data?.canDelete ?? false

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Lista de Agendas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Consulte e gerencie as agendas cadastradas no sistema.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 card-shadow space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setFilterTipo('data')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  filterTipo === 'data' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                Período
              </button>
              <button
                onClick={() => setFilterTipo('mes_referencia')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  filterTipo === 'mes_referencia' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                Mês referência
              </button>
            </div>
          </div>

          {filterTipo === 'data' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mês referência</label>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Gestor</label>
            <select
              value={idGestor}
              onChange={(e) => setIdGestor(e.target.value)}
              disabled={data?.isComercial}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-40 disabled:opacity-60"
            >
              <option value="">{data?.isComercial ? 'Você' : 'Todos'}</option>
              {data?.gestores.map((g) => (
                <option key={g.id_user} value={g.id_user}>
                  {g.Nome ?? `#${g.id_user}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vendedor</label>
            <select
              value={idVendedor}
              onChange={(e) => setIdVendedor(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-44"
            >
              <option value="">Todos</option>
              {data?.vendedores.map((v) => (
                <option key={v.id_user} value={v.id_user}>
                  {v.Nome ?? `#${v.id_user}`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadList}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Pesquisar
          </button>
          <button
            onClick={loadList}
            disabled={loading}
            className="h-10 px-3 rounded-lg border border-border bg-background text-sm hover:bg-muted transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando agendas...</span>
            </div>
          ) : (data?.agendas?.length ?? 0) === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhuma agenda encontrada com os filtros selecionados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  {canDelete && <th className="px-3 py-3 font-medium w-10 text-center"></th>}
                  <th className="px-3 py-3 font-medium">Nº Agenda</th>
                  <th className="px-3 py-3 font-medium">Vendedor</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium text-right">Q. Visitas</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.agendas.map((a) => {
                  const dateStr = a.data_agenda
                    ? new Date(a.data_agenda).toLocaleDateString('pt-BR')
                    : '—'
                  const statusColor =
                    a.status_atual === 'Finalizado'
                      ? 'bg-green-100 text-green-700'
                      : a.status_atual === 'Cancelado'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  return (
                    <tr key={a.id_agenda} className="hover:bg-muted/30">
                      {canDelete && (
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(a.id_agenda)}
                            onChange={() => toggleSelected(a.id_agenda)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 font-medium tabular-nums">#{a.id_agenda}</td>
                      <td className="px-3 py-3">{a.vendedor?.Nome ?? '—'}</td>
                      <td className="px-3 py-3 tabular-nums">{dateStr}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.total_visitas ?? 0}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColor}`}>
                          {a.status_atual ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => openDetail(a.id_agenda)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver detalhe
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete bar */}
      {canDelete && selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto max-w-fit">
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="h-11 px-5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg disabled:opacity-60"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir {selected.size} agenda(s)
          </button>
        </div>
      )}

      {/* Detail popup */}
      {detailId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => {
            if (!savingDetail) {
              setDetail(null)
              setDetailId(null)
            }
          }}
        >
          <div
            className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-semibold text-foreground">Detalhamento da Agenda</h3>
              <button
                onClick={() => {
                  setDetail(null)
                  setDetailId(null)
                }}
                disabled={savingDetail}
                className="p-2 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : detail ? (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Field label="Nº Agenda" value={`#${detail.agenda.id_agenda}`} />
                  <Field label="Vendedor" value={detail.agenda.vendedor?.Nome ?? '—'} />
                  <Field
                    label="Data"
                    value={detail.agenda.data_agenda ? new Date(detail.agenda.data_agenda).toLocaleDateString('pt-BR') : '—'}
                  />
                  <Field label="Q. Visitas" value={String(detail.visitas.length)} />
                  <Field label="Status" value={detail.agenda.status_atual ?? '—'} />
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                    Visitas ({detail.visitas.length})
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr className="text-left text-xs uppercase text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Código</th>
                          <th className="px-3 py-2 font-medium">Razão</th>
                          <th className="px-3 py-2 font-medium">Bairro</th>
                          <th className="px-3 py-2 font-medium">Cidade</th>
                          <th className="px-3 py-2 font-medium w-16">UF</th>
                          {detail.canEdit && <th className="px-3 py-2 font-medium w-16 text-center">Manter</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.visitas.map((v) => (
                          <tr key={v.id_ad} className="hover:bg-muted/30">
                            <td className="px-3 py-2 tabular-nums">{v.id_clientes ?? '—'}</td>
                            <td className="px-3 py-2">{v.cliente?.Razao ?? '—'}</td>
                            <td className="px-3 py-2">{v.cliente?.Bairro ?? '—'}</td>
                            <td className="px-3 py-2">{v.cliente?.Cidade ?? '—'}</td>
                            <td className="px-3 py-2 text-center">{v.cliente?.UF ?? '—'}</td>
                            {detail.canEdit && (
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={keepIds.has(v.id_ad)}
                                  onChange={() => toggleKeep(v.id_ad)}
                                  className="w-4 h-4 accent-primary cursor-pointer"
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detail.canEdit && (
                  <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">Adicionar novo cliente</h4>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={addingCodigo}
                        onChange={(e) => setAddingCodigo(e.target.value)}
                        placeholder="Código do cliente"
                        className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Itens não marcados em "Manter" serão excluídos ao salvar.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setDetail(null)
                      setDetailId(null)
                    }}
                    disabled={savingDetail}
                    className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition"
                  >
                    Fechar
                  </button>
                  {detail.canEdit && (
                    <button
                      onClick={saveDetail}
                      disabled={savingDetail}
                      className="h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
                    >
                      {savingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground truncate">{value}</div>
    </div>
  )
}
