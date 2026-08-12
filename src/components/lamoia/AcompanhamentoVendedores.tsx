'use client'

import { useState, useEffect, useMemo } from 'react'
import { Filter, RefreshCw, TrendingUp, CalendarCheck2, ClipboardList, MapPin, CheckCircle2, Clock, Eye, X } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts'
import { StatCard } from './StatCard'
import { toast } from 'sonner'

interface Stats {
  total_agendas: number
  auditorias_realizadas: number
  visitas_agendadas: number
  visitas_realizadas: number
  eficiencia: number
  total_horas: string
}

interface WeeklyPoint { semana: string; agendadas: number; realizadas: number }
interface StatusCount { status: string; total: number }
interface MonthlyPoint { mes: string; agendadas: number; realizadas: number }
interface DayRow {
  data: string
  total_visitas: number
  realizadas: number
  canceladas: number
  eficiencia: number
  total_hora: string | null
  status_atual: string | null
  id_agenda: number | null
}

interface Visita {
  id_ad: number
  id_clientes: number | null
  status_atendimento: string | null
  cliente?: { Razao: string | null } | null
}

interface AcompanhamentoProps {
  isComercial: boolean
  userId: number
}

const statusColors: Record<string, string> = {
  'Realizado': '#16a34a',
  'Cancelado': '#dc2626',
  'Pendente': '#f59e0b',
  'Pendente Auditoria': '#3b82f6',
  'Em Atendimento': '#8b5cf6',
}

const statusBadgeColors: Record<string, string> = {
  'Realizado': 'bg-green-100 text-green-700',
  'Cancelado': 'bg-red-100 text-red-700',
  'Pendente': 'bg-amber-100 text-amber-700',
  'Pendente Auditoria': 'bg-blue-100 text-blue-700',
  'Em Atendimento': 'bg-purple-100 text-purple-700',
  'Finalizado': 'bg-green-100 text-green-700',
}

export function AcompanhamentoVendedores({ isComercial, userId }: AcompanhamentoProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    stats: Stats
    weekly: WeeklyPoint[]
    statusCounts: StatusCount[]
    monthly6: MonthlyPoint[]
    daily: DayRow[]
  } | null>(null)

  // Filters
  const [mesReferenciaInput, setMesReferenciaInput] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const mesReferencia = useMemo(() => {
    if (!mesReferenciaInput.includes('-')) return mesReferenciaInput
    const [y, m] = mesReferenciaInput.split('-')
    return `${m}-${y}`
  }, [mesReferenciaInput])

  const [idGestor, setIdGestor] = useState('')
  const [idVendedor, setIdVendedor] = useState('')

  // Dropdown options
  const [gestores, setGestores] = useState<{ id_user: number; Nome: string | null }[]>([])
  const [vendedores, setVendedores] = useState<{ id_user: number; Nome: string | null }[]>([])

  // Popup state (for "Ver visitas")
  const [popupDay, setPopupDay] = useState<DayRow | null>(null)
  const [popupVisitas, setPopupVisitas] = useState<Visita[]>([])
  const [popupLoading, setPopupLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/users/gestores').then((r) => r.json()).catch(() => ({ gestores: [] })),
      fetch('/api/users/vendedores').then((r) => r.json()).catch(() => ({ vendedores: [] })),
    ]).then(([g, v]) => {
      setGestores(g.gestores ?? [])
      setVendedores(v.vendedores ?? [])
    })
  }, [])

  async function loadAcompanhamento() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('mes_referencia', mesReferencia)
      if (idGestor) params.set('id_gerente', idGestor)
      if (idVendedor) params.set('id_vendedor', idVendedor)

      const r = await fetch('/api/acompanhamento?' + params.toString())
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.erro || 'Falha ao carregar')
      }
      const d = await r.json()
      setData(d)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar acompanhamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAcompanhamento()
  }, [mesReferencia, idGestor, idVendedor])

  async function openDayVisitas(day: DayRow) {
    if (!day.id_agenda) {
      toast.info('Sem agenda vinculada a este dia.')
      return
    }
    setPopupDay(day)
    setPopupVisitas([])
    setPopupLoading(true)
    try {
      const r = await fetch(`/api/agenda/${day.id_agenda}`)
      if (!r.ok) throw new Error('Falha ao carregar visitas')
      const d = await r.json()
      setPopupVisitas(d.visitas ?? [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar visitas')
    } finally {
      setPopupLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Acompanhe a carteira, o desempenho e a produtividade dos vendedores.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 card-shadow space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Mês referência</label>
            <input
              type="month"
              value={mesReferenciaInput}
              onChange={(e) => setMesReferenciaInput(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {!isComercial && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Gestor</label>
              <select
                value={idGestor}
                onChange={(e) => setIdGestor(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-44"
              >
                <option value="">Todos</option>
                {gestores.map((g) => (
                  <option key={g.id_user} value={g.id_user}>
                    {g.Nome ?? `#${g.id_user}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Vendedor</label>
            <select
              value={idVendedor}
              onChange={(e) => setIdVendedor(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-48"
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id_user} value={v.id_user}>
                  {v.Nome ?? `#${v.id_user}`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadAcompanhamento}
            disabled={loading}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Stat cards (6 cards) */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Agendas" value={data?.stats.total_agendas ?? 0} icon={ClipboardList} accent="primary" />
          <StatCard label="Auditorias" value={data?.stats.auditorias_realizadas ?? 0} icon={CalendarCheck2} accent="accent" />
          <StatCard label="Visitas Agendadas" value={data?.stats.visitas_agendadas ?? 0} icon={MapPin} accent="primary" />
          <StatCard label="Visitas Realizadas" value={data?.stats.visitas_realizadas ?? 0} icon={CheckCircle2} accent="accent" />
          <StatCard label="Eficiência" value={`${(data?.stats.eficiencia ?? 0).toFixed(1)}%`} icon={TrendingUp} accent="accent" />
          <StatCard label="Total Horas" value={data?.stats.total_horas ?? '00:00'} icon={Clock} accent="primary" />
        </div>
      )}

      {/* Two bar charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-base font-semibold text-foreground mb-1">Visitas Semanal</h3>
          <p className="text-xs text-muted-foreground mb-4">Agendadas vs Realizadas por semana do mês</p>
          <div style={{ width: '100%', height: 300 }}>
            {(data?.weekly?.length ?? 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.weekly} margin={{ top: 20, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="agendadas" name="Agendadas" fill="#132999" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="realizadas" name="Realizadas" fill="#5a8f0a" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-base font-semibold text-foreground mb-1">Visitas por Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição do status no mês</p>
          <div style={{ width: '100%', height: 300 }}>
            {(data?.statusCounts?.length ?? 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.statusCounts} margin={{ top: 20, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" name="Visitas" radius={[6, 6, 0, 0]} barSize={50}>
                    {data?.statusCounts.map((entry, idx) => (
                      <Cell key={idx} fill={statusColors[entry.status] ?? '#9ca3af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 6-month line chart */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow">
        <h3 className="text-base font-semibold text-foreground mb-1">Evolução nos últimos 6 meses</h3>
        <p className="text-xs text-muted-foreground mb-4">Total de visitas Agendadas vs Realizadas</p>
        <div style={{ width: '100%', height: 300 }}>
          {(data?.monthly6?.length ?? 0) === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.monthly6} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="agendadas" name="Agendadas" stroke="#132999" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="realizadas" name="Realizadas" stroke="#AEF544" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Daily table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Detalhamento diário</h3>
          <p className="text-xs text-muted-foreground mt-1">Agendas do mês selecionado, dia a dia</p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (data?.daily?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma agenda no período selecionado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Dia</th>
                  <th className="px-3 py-3 font-medium text-right">Visitas</th>
                  <th className="px-3 py-3 font-medium text-right">Realizadas</th>
                  <th className="px-3 py-3 font-medium text-right">Canceladas</th>
                  <th className="px-3 py-3 font-medium text-right">Eficiência</th>
                  <th className="px-3 py-3 font-medium text-right">Total Horas</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.daily.map((row) => (
                  <tr key={row.data} className="hover:bg-muted/30">
                    <td className="px-3 py-3 tabular-nums">
                      {row.data.split('-').reverse().join('/')}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.total_visitas}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-green-600">{row.realizadas}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-red-600">{row.canceladas}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium tabular-nums text-xs">
                        {row.eficiencia.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.total_hora ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeColors[row.status_atual ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                        {row.status_atual ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => openDayVisitas(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition"
                        title="Ver visitas do dia"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Day visitas popup */}
      {popupDay && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPopupDay(null)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div>
                <h3 className="font-semibold text-foreground">Visitas do dia</h3>
                <p className="text-xs text-muted-foreground">
                  {popupDay.data.split('-').reverse().join('/')} • Agenda #{popupDay.id_agenda}
                </p>
              </div>
              <button
                onClick={() => setPopupDay(null)}
                className="p-2 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {popupLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : popupVisitas.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma visita encontrada.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Código</th>
                      <th className="px-3 py-2 font-medium">Razão</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {popupVisitas.map((v) => (
                      <tr key={v.id_ad} className="hover:bg-muted/30">
                        <td className="px-3 py-2 tabular-nums">{v.id_clientes ?? '—'}</td>
                        <td className="px-3 py-2">{v.cliente?.Razao ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeColors[v.status_atendimento ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                            {v.status_atendimento ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
