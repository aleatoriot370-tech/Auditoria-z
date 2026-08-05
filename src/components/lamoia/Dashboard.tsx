'use client'

import { useState, useMemo, useEffect } from 'react'
import { Filter, RefreshCw, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from 'recharts'
import { StatCard } from './StatCard'
import {
  CalendarCheck2, ClipboardList, MapPin, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

interface DashboardData {
  stats: {
    total_agendas: number
    auditorias_realizadas: number
    visitas_agendadas: number
    visitas_realizadas: number
    eficiencia_media?: number
  }
  daily: { data: string; agendas: number; auditorias: number }[]
  statusCounts: { status: string; total: number }[]
  recent: any[]
}

interface DashboardProps {
  isComercial: boolean
  userName: string | null
}

/** Convert input[type=month] "YYYY-MM" → DB mes_referencia "MM-YYYY". */
function toMesReferencia(ym: string): string {
  // ym format: "2026-08" → "08-2026"
  if (!ym || !ym.includes('-')) return ym
  const [y, m] = ym.split('-')
  return `${m}-${y}`
}

/** Convert DB mes_referencia "MM-YYYY" → input[type=month] "YYYY-MM". */
function toMonthInput(mr: string): string {
  if (!mr || !mr.includes('-')) return mr
  const [m, y] = mr.split('-')
  return `${y}-${m}`
}

export function Dashboard({ isComercial, userName }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)

  // filters
  const [filterTipo, setFilterTipo] = useState<'mes' | 'periodo'>('mes')
  // Input value in YYYY-MM format (HTML month input).
  // Internal state stores MM-YYYY (DB format) for direct use in API requests.
  const [mesReferenciaInput, setMesReferenciaInput] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const mesReferencia = toMesReferencia(mesReferenciaInput)

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [idGestor, setIdGestor] = useState('')
  const [idVendedor, setIdVendedor] = useState('')

  // Dropdown options
  const [gestores, setGestores] = useState<{ id_user: number; Nome: string | null }[]>([])
  const [vendedores, setVendedores] = useState<{ id_user: number; Nome: string | null }[]>([])

  // Load dropdown options once on mount — independent of dashboard data.
  useEffect(() => {
    Promise.all([
      fetch('/api/users/gestores').then((r) => r.json()).catch(() => ({ gestores: [] })),
      fetch('/api/users/vendedores').then((r) => r.json()).catch(() => ({ vendedores: [] })),
    ]).then(([g, v]) => {
      setGestores(g.gestores ?? [])
      setVendedores(v.vendedores ?? [])
    })
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTipo === 'mes') {
        params.set('mes_referencia', mesReferencia) // already in MM-YYYY format
      } else {
        if (dataInicio) params.set('data_inicio', dataInicio)
        if (dataFim) params.set('data_fim', dataFim)
      }
      if (idGestor) params.set('id_gerente', idGestor)
      if (idVendedor) params.set('id_vendedor', idVendedor)

      const r = await fetch('/api/dashboard?' + params.toString())
      if (!r.ok) throw new Error('Falha ao carregar dashboard')
      const d = await r.json()
      setData(d)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Reload dashboard when filters change
  useEffect(() => {
    loadDashboard()
  }, [filterTipo, mesReferencia, dataInicio, dataFim, idGestor, idVendedor])

  const dailyChartData = useMemo(() => {
    if (!data?.daily) return []
    return data.daily.map((p) => ({
      ...p,
      data: p.data.slice(8, 10) + '/' + p.data.slice(5, 7),
    }))
  }, [data])

  const statusChartData = useMemo(() => {
    if (!data?.statusCounts) return []
    return data.statusCounts.map((s) => ({
      status: s.status,
      total: s.total,
    }))
  }, [data])

  const eficienciaCard = useMemo(() => {
    const agendadas = data?.stats.visitas_agendadas ?? 0
    const realizadas = data?.stats.visitas_realizadas ?? 0
    if (agendadas === 0) return 0
    return (realizadas / agendadas) * 100
  }, [data])

  const statusColors: Record<string, string> = {
    'Realizado': '#16a34a',
    'Cancelado': '#dc2626',
    'Pendente': '#f59e0b',
    'Pendente Auditoria': '#3b82f6',
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Subtitle */}
      <div>
        <p className="text-sm text-muted-foreground">
          {isComercial
            ? `Visão filtrada pelo seu gestor: ${userName ?? ''}`
            : 'Indicadores de desempenho geral das equipes comerciais.'}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 card-shadow">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setFilterTipo('mes')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  filterTipo === 'mes' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                Mês referência
              </button>
              <button
                type="button"
                onClick={() => setFilterTipo('periodo')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  filterTipo === 'periodo' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                }`}
              >
                Período
              </button>
            </div>
          </div>

          {filterTipo === 'mes' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mês referência</label>
              <input
                type="month"
                value={mesReferenciaInput}
                onChange={(e) => setMesReferenciaInput(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}

          {!isComercial && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Gestor</label>
              <select
                value={idGestor}
                onChange={(e) => setIdGestor(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-40"
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

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vendedor</label>
            <select
              value={idVendedor}
              onChange={(e) => setIdVendedor(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-44"
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
            onClick={loadDashboard}
            disabled={loading}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Stat cards (5 cards) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total de Agendas"
            value={data?.stats.total_agendas ?? 0}
            icon={ClipboardList}
            accent="primary"
          />
          <StatCard
            label="Auditorias Realizadas"
            value={data?.stats.auditorias_realizadas ?? 0}
            icon={CalendarCheck2}
            accent="accent"
          />
          <StatCard
            label="Visitas Agendadas"
            value={data?.stats.visitas_agendadas ?? 0}
            icon={MapPin}
            accent="primary"
          />
          <StatCard
            label="Visitas Realizadas"
            value={data?.stats.visitas_realizadas ?? 0}
            icon={CheckCircle2}
            accent="accent"
          />
          <StatCard
            label="Eficiência"
            value={`${eficienciaCard.toFixed(1)}%`}
            icon={TrendingUp}
            accent="accent"
            hint="(Realizadas / Agendadas) × 100"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-base font-semibold text-foreground mb-1">
            Agendas vs Auditorias
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Comparação diária no período filtrado
          </p>
          <div className="h-72">
            {dailyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="agendas" name="Agendas" stroke="#132999" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="auditorias" name="Auditorias" stroke="#AEF544" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-base font-semibold text-foreground mb-1">
            Visitas por Status
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Distribuição do status de atendimento
          </p>
          <div className="h-72">
            {statusChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Visitas" radius={[6, 6, 0, 0]}>
                    {statusChartData.map((entry, idx) => (
                      <Cell key={idx} fill={statusColors[entry.status] ?? '#9ca3af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent audits table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Últimas Auditorias Realizadas</h3>
          <p className="text-xs text-muted-foreground mt-1">Ordenado por data de auditoria</p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (data?.recent?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma auditoria realizada no período.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Gestor</th>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium text-right">Vis. Agendadas</th>
                  <th className="px-4 py-3 font-medium text-right">Realizadas</th>
                  <th className="px-4 py-3 font-medium text-right">Canceladas</th>
                  <th className="px-4 py-3 font-medium text-right">Total Horas</th>
                  <th className="px-4 py-3 font-medium text-right">Eficiência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.recent.map((row) => (
                  <tr key={row.id_agenda} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{row.gerente}</td>
                    <td className="px-4 py-3">{row.vendedor}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.visitas_agendadas}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">{row.visitas_realizadas}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{row.visitas_canceladas}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.total_hora ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium tabular-nums">
                        {(row.eficiencia ?? 0).toFixed(1)}%
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
  )
}
