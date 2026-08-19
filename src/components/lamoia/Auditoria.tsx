'use client'

import { useState, useEffect } from 'react'
import {
  Search, Loader2, AlertCircle, Info, Clock, MapPin,
  CheckCircle2, XCircle, Hourglass, AlertTriangle, Save, X,
} from 'lucide-react'
import { toast } from 'sonner'

interface Visita {
  id_ad: number
  id_clientes: number | null
  status_atendimento: string | null
  observacao: string | null
  latitude: string | null
  longitude: string | null
  cliente?: {
    Razao: string | null
    Bairro: string | null
    Cidade: string | null
    UF: string | null
  } | null
  data_hora_atendimento_inicio?: string | null
  data_hora_atendimento_fim?: string | null
  // legacy alias kept for backward compat
  data_hora_atendimento?: string | null
}

interface FotoVis {
  id_foto: number
  id_vis: number | null
  Nome_Foto: string | null
  Tipo: string | null
  Loc_Foto: string | null
}

interface Agenda {
  id_agenda: number
  placa: string | null
  status_atual: string | null
  data_agenda: string | null
  hora_inicial: string | null
  hora_fim: string | null
  total_hora: string | null
  almoco: string | null
  obs_geral: string | null
  gerente?: { Nome: string | null } | null
  vendedor?: { Nome: string | null } | null
}

interface SearchResult {
  encontrado: boolean
  mensagem?: string
  agenda?: Agenda
  visitas?: Visita[]
  counts?: {
    total: number
    pendente: number
    pendente_aud: number
    realizado: number
    cancelado: number
  }
  readOnly?: boolean
  readOnlyReason?: string | null
}

/**
 * Format permanence (duration) between two timestamps.
 * Returns null if either is missing or invalid.
 *
 * @example
 *   formatPermanencia('2026-08-05T08:00:00', '2026-08-05T08:45:30')
 *   // → { duracao: '45min 30s', inicio: '08:00', fim: '08:45' }
 */
function formatPermanencia(
  inicio?: string | null,
  fim?: string | null
): { duracao: string; inicio: string; fim: string } | null {
  if (!inicio || !fim) return null
  try {
    const dIni = new Date(inicio)
    const dFim = new Date(fim)
    if (Number.isNaN(dIni.getTime()) || Number.isNaN(dFim.getTime())) return null
    if (dFim <= dIni) return null

    const diffMs = dFim.getTime() - dIni.getTime()
    const totalMin = Math.floor(diffMs / 60000)
    const horas = Math.floor(totalMin / 60)
    const minutos = totalMin % 60
    const segundos = Math.floor((diffMs % 60000) / 1000)

    let duracao: string
    if (horas > 0) {
      duracao = `${horas}h ${String(minutos).padStart(2, '0')}min`
    } else if (minutos > 0) {
      duracao = `${minutos}min ${String(segundos).padStart(2, '0')}s`
    } else {
      duracao = `${segundos}s`
    }

    const fmtTime = (d: Date) =>
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return {
      duracao,
      inicio: fmtTime(dIni),
      fim: fmtTime(dFim),
    }
  } catch {
    return null
  }
}

export function Auditoria() {
  const [dataAgenda, setDataAgenda] = useState(() => new Date().toISOString().slice(0, 10))
  const [vendedores, setVendedores] = useState<{ id_user: number; Nome: string | null }[]>([])
  const [idVendedor, setIdVendedor] = useState('')
  const [loadingV, setLoadingV] = useState(true)

  const [result, setResult] = useState<SearchResult | null>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [horaInicial, setHoraInicial] = useState('08:00')
  const [horaFim, setHoraFim] = useState('17:00')
  const [almoco, setAlmoco] = useState(true)
  const [obsGeral, setObsGeral] = useState('')
  const [visitasEdit, setVisitasEdit] = useState<Visita[]>([])
  const [saving, setSaving] = useState(false)

  // Load vendedores list (active Comercial users)
  useEffect(() => {
    fetch('/api/users/vendedores')
      .then((r) => r.json())
      .then((d) => setVendedores(d.vendedores ?? []))
      .catch(() => toast.error('Erro ao carregar vendedores'))
      .finally(() => setLoadingV(false))
  }, [])

  async function handleSearch() {
    setError(null)
    setResult(null)
    if (!dataAgenda || !idVendedor) {
      setError('Informe a data da agenda e o vendedor.')
      return
    }
    setLoadingSearch(true)
    try {
      const r = await fetch(`/api/auditoria/search?data_agenda=${dataAgenda}&id_vendedor=${idVendedor}`)
      const d = await r.json()
      setResult(d)
      if (d.encontrado && d.agenda) {
        setHoraInicial(d.agenda.hora_inicial || '08:00')
        setHoraFim(d.agenda.hora_fim || '17:00')
        setAlmoco(d.agenda.almoco !== 'N')
        setObsGeral(d.agenda.obs_geral || '')
        setVisitasEdit(d.visitas ?? [])
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar agenda')
    } finally {
      setLoadingSearch(false)
    }
  }

  function updateVisita(id_ad: number, patch: Partial<Visita>) {
    setVisitasEdit((prev) => prev.map((v) => (v.id_ad === id_ad ? { ...v, ...patch } : v)))
  }

  function computeTotalHora(): string {
    const [hi, mi] = horaInicial.split(':').map(Number)
    const [hf, mf] = horaFim.split(':').map(Number)
    if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return '--:--'
    const iniMin = hi * 60 + mi
    const fimMin = hf * 60 + mf
    if (fimMin <= iniMin) return '--:--'
    let diff = fimMin - iniMin
    if (almoco) diff = Math.max(0, diff - 60)
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  async function handleSave() {
    if (!result?.agenda) return
    const invalid = visitasEdit.filter(
      (v) => v.status_atendimento !== 'Realizado' && v.status_atendimento !== 'Cancelado'
    )
    if (invalid.length > 0) {
      toast.error(`Existem ${invalid.length} visita(s) sem status "Realizado" ou "Cancelado".`)
      return
    }
    if (!horaInicial || !horaFim) {
      toast.error('Horário inicial e fim são obrigatórios.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/auditoria/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_agenda: result.agenda.id_agenda,
          hora_inicial: horaInicial,
          hora_fim: horaFim,
          almoco: almoco ? 'S' : 'N',
          obs_geral: obsGeral,
          visitas: visitasEdit.map((v) => ({
            id_ad: v.id_ad,
            status_atendimento: v.status_atendimento,
            observacao: v.observacao,
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.erro || 'Falha ao salvar auditoria')
        return
      }
      toast.success(`Auditoria salva! Eficiência: ${d.eficiencia}% • Total: ${d.total_hora}`)
      setResult(null)
      setVisitasEdit([])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Deseja cancelar todas as alterações? As informações não salvas serão perdidas.')) return
    setResult(null)
    setVisitasEdit([])
    setObsGeral('')
  }

  const readOnly = result?.readOnly === true

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Busque a agenda por data e vendedor para auditar as visitas realizadas.
        </p>
      </div>

      {/* Search filters */}
      <div className="rounded-xl border border-border bg-card p-4 card-shadow">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Data da agenda</label>
            <input
              type="date"
              value={dataAgenda}
              onChange={(e) => setDataAgenda(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-48">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Vendedor</label>
            <select
              value={idVendedor}
              onChange={(e) => setIdVendedor(e.target.value)}
              disabled={loadingV}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{loadingV ? 'Carregando...' : 'Selecione...'}</option>
              {vendedores.map((v) => (
                <option key={v.id_user} value={v.id_user}>
                  {v.Nome ?? `#${v.id_user}`}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={loadingSearch}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
          >
            {loadingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Abrir</span>
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Result */}
      {result && !result.encontrado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
          <h3 className="font-semibold text-amber-800">Agenda não localizada</h3>
          <p className="text-sm text-amber-700 mt-1">
            {result.mensagem || 'Não foi encontrada agenda para o vendedor na data informada.'}
          </p>
        </div>
      )}

      {result && result.encontrado && result.agenda && (
        <>
          {/* Read-only banner */}
          {readOnly && (
            <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-800">Somente visualização</p>
                <p className="text-sm text-blue-700">
                  {result.readOnlyReason || 'Esta agenda não pode ser alterada.'}
                </p>
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Gestor" value={result.agenda.gerente?.Nome ?? '-'} />
            <Card label="Vendedor" value={result.agenda.vendedor?.Nome ?? '-'} />
            <Card label="Placa" value={result.agenda.placa ?? '-'} />
            <Card label="Status" value={result.agenda.status_atual ?? '-'} />
            <Card label="Visitas Agendadas" value={String(result.counts?.total ?? 0)} />
            <Card label="Pendentes" value={String(result.counts?.pendente ?? 0)} accent="amber" />
            <Card label="Realizadas" value={String(result.counts?.realizado ?? 0)} accent="green" />
            <Card
              label="Eficiência"
              value={
                result.agenda.eficiencia != null
                  ? `${result.agenda.eficiencia.toFixed(1)}%`
                  : result.counts && result.counts.total > 0
                  ? `${((result.counts.realizado / result.counts.total) * 100).toFixed(1)}%`
                  : '—'
              }
              accent="accent"
            />
          </div>

          {/* Rota fields */}
          <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Horários da Rota
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Início da Rota</label>
                <input
                  type="time"
                  value={horaInicial}
                  onChange={(e) => setHoraInicial(e.target.value)}
                  disabled={readOnly}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Fim da Rota</label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  disabled={readOnly}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Total de Horas</label>
                <div className="h-10 px-3 rounded-lg border border-border bg-muted/40 flex items-center font-mono text-sm tabular-nums">
                  {computeTotalHora()}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Incluir horário de almoço</label>
                <label className="h-10 px-3 rounded-lg border border-border bg-background flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={almoco}
                    onChange={(e) => setAlmoco(e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">Descontar 1h</span>
                </label>
              </div>
            </div>
          </div>

          {/* Agenda do dia */}
          <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Agenda do Dia</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {visitasEdit.length} visita(s) programada(s)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Cód.</th>
                    <th className="px-3 py-3 font-medium">Razão</th>
                    <th className="px-3 py-3 font-medium">Bairro</th>
                    <th className="px-3 py-3 font-medium">Cidade</th>
                    <th className="px-3 py-3 font-medium">Permanência</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Observação</th>
                    <th className="px-3 py-3 font-medium text-center">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visitasEdit.map((v) => {
                    const perm = formatPermanencia(v.data_hora_atendimento_inicio ?? v.data_hora_atendimento, v.data_hora_atendimento_fim)
                    return (
                      <tr key={v.id_ad} className="hover:bg-muted/30 align-top">
                        <td className="px-3 py-3 tabular-nums">{v.id_clientes ?? '-'}</td>
                        <td className="px-3 py-3">{v.cliente?.Razao ?? '-'}</td>
                        <td className="px-3 py-3">{v.cliente?.Bairro ?? '-'}</td>
                        <td className="px-3 py-3">{v.cliente?.Cidade ?? '-'}</td>
                        <td className="px-3 py-3 tabular-nums text-xs">
                          {perm ? (
                            <span className="inline-flex flex-col leading-tight">
                              <span className="font-medium text-foreground">{perm.duracao}</span>
                              <span className="text-muted-foreground text-[10px]">
                                {perm.inicio} → {perm.fim}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 min-w-40">
                          <select
                            value={v.status_atendimento ?? 'Pendente'}
                            onChange={(e) => updateVisita(v.id_ad, { status_atendimento: e.target.value })}
                            disabled={readOnly}
                            className={`w-full h-9 px-2 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 ${
                              v.status_atendimento === 'Realizado'
                                ? 'text-green-700 bg-green-50'
                                : v.status_atendimento === 'Cancelado'
                                ? 'text-red-700 bg-red-50'
                                : v.status_atendimento === 'Em Atendimento'
                                ? 'text-blue-700 bg-blue-50'
                                : 'text-amber-700 bg-amber-50'
                            }`}
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Pendente Auditoria">Pendente Auditoria</option>
                            <option value="Em Atendimento">Em Atendimento</option>
                            <option value="Realizado">Realizado</option>
                            <option value="Cancelado">Cancelado</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-48">
                          <input
                            type="text"
                            value={v.observacao ?? ''}
                            onChange={(e) => updateVisita(v.id_ad, { observacao: e.target.value })}
                            disabled={readOnly}
                            placeholder="—"
                            className="w-full h-9 px-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <ViewMapButton visita={v} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Obs geral */}
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <label className="text-sm font-medium text-foreground block mb-2">Observação Geral</label>
            <textarea
              value={obsGeral}
              onChange={(e) => setObsGeral(e.target.value.slice(0, 300))}
              disabled={readOnly}
              maxLength={300}
              rows={3}
              placeholder="Observações gerais sobre a rota auditada..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {obsGeral.length}/300
            </div>
          </div>

          {/* Buttons */}
          {!readOnly && (
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Auditoria
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'amber' | 'accent' }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    accent: 'text-[#132999] font-bold',
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
        {label}
      </div>
      <div className={`mt-1.5 text-lg font-semibold truncate ${accent ? colorMap[accent] : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  )
}

/**
 * Convert a Google Drive "uc?id=XXX" URL to a thumbnail URL that reliably
 * renders in <img> tags (browsers block the raw "uc?id=" endpoint as a
 * cross-origin download). Falls back to the original URL if it's not a
 * Google Drive link.
 */
function toImageUrl(loc: string | null | undefined): string | null {
  if (!loc) return null
  const trimmed = loc.trim()

  // 1. Google Drive "uc?id=XXX" format → thumbnail endpoint
  const m1 = trimmed.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/)
  if (m1) {
    return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w1000`
  }

  // 2. Google Drive "file/d/ID/" format → thumbnail endpoint
  const m2 = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m2) {
    return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w1000`
  }

  // 3. lh3.googleusercontent.com/d/ID format (Google Drive direct view)
  //    Convert to drive.google.com/thumbnail which works reliably in <img> tags
  const m3 = trimmed.match(/lh\d*\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/)
  if (m3) {
    return `https://drive.google.com/thumbnail?id=${m3[1]}&sz=w1000`
  }

  // 4. MEGA links — use server-side proxy to fetch, decrypt and serve.
  //    /api/fotos/mega/FILE_ID?key=KEY
  const m4 = trimmed.match(/mega\.nz\/file\/([a-zA-Z0-9_-]+)#([a-zA-Z0-9_-]+)/)
  if (m4) {
    return `/api/fotos/mega/${m4[1]}?k=${encodeURIComponent(m4[2])}`
  }
  // Old MEGA format: /#!ID!KEY
  const m4b = trimmed.match(/mega\.nz\/#!([a-zA-Z0-9_-]+)!([a-zA-Z0-9_-]+)/)
  if (m4b) {
    return `/api/fotos/mega/${m4b[1]}?k=${encodeURIComponent(m4b[2])}`
  }

  // 5. Any other URL (direct image links, base64 data URIs, etc.) — use as-is
  return trimmed
}

function ViewMapButton({ visita }: { visita: Visita }) {
  const [open, setOpen] = useState(false)
  const [fotos, setFotos] = useState<FotoVis[]>([])
  const [loadingFotos, setLoadingFotos] = useState(false)
  const [lightbox, setLightbox] = useState<FotoVis | null>(null)

  const lat = visita.latitude
  const lng = visita.longitude
  const hasCoords = lat && lng

  // Compute permanence for header display
  const perm = formatPermanencia(
    visita.data_hora_atendimento_inicio ?? visita.data_hora_atendimento,
    visita.data_hora_atendimento_fim
  )

  async function openPopup() {
    setOpen(true)
    // Fetch photos from fotos_vis table
    if (visita.id_ad) {
      setLoadingFotos(true)
      try {
        const r = await fetch(`/api/fotos/${visita.id_ad}`)
        if (r.ok) {
          const d = await r.json()
          setFotos(d.fotos ?? [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingFotos(false)
      }
    }
  }

  // Group photos by Tipo
  const fotosByTipo: Record<string, FotoVis[]> = { Fachada: [], Antes: [], Depois: [] }
  for (const f of fotos) {
    const t = f.Tipo ?? 'Outros'
    if (!fotosByTipo[t]) fotosByTipo[t] = []
    fotosByTipo[t].push(f)
  }

  return (
    <>
      <button
        onClick={openPopup}
        className="p-2 rounded-md hover:bg-muted transition"
        title="Ver mapa e fotos"
      >
        <MapPin className="w-4 h-4 text-primary" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{visita.cliente?.Razao ?? `Cliente #${visita.id_clientes}`}</h3>
                {hasCoords && (
                  <p className="text-xs text-muted-foreground">
                    Lat: {lat} • Lng: {lng}
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-muted rounded-md shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Atendimento info (início, fim, permanência) */}
              {perm && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Atendimento
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Início</div>
                      <div className="font-semibold text-foreground tabular-nums">{perm.inicio}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fim</div>
                      <div className="font-semibold text-foreground tabular-nums">{perm.fim}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Permanência</div>
                      <div className="font-bold text-primary tabular-nums">{perm.duracao}</div>
                    </div>
                  </div>
                </div>
              )}

              {hasCoords && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <iframe
                    title="map"
                    width="100%"
                    height="280"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.01}%2C${Number(lat) - 0.01}%2C${Number(lng) + 0.01}%2C${Number(lat) + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                  />
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Galeria de fotos</h4>
                {loadingFotos ? (
                  <div className="text-sm text-muted-foreground">Carregando fotos...</div>
                ) : fotos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma foto cadastrada para esta visita.</div>
                ) : (
                  <div className="space-y-3">
                    {['Fachada', 'Antes', 'Depois'].map((tipo) => {
                      const list = fotosByTipo[tipo] ?? []
                      return (
                        <div key={tipo}>
                          <div className="text-xs font-medium text-muted-foreground mb-1">{tipo} ({list.length})</div>
                          {list.length === 0 ? (
                            <div className="text-xs text-muted-foreground/60">—</div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {list.map((f) => {
                                const url = toImageUrl(f.Loc_Foto)
                                return (
                                  <button
                                    key={f.id_foto}
                                    onClick={() => setLightbox(f)}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition group bg-muted/30"
                                  >
                                    {url ? (
                                      <img
                                        src={url}
                                        alt={f.Nome_Foto ?? `Foto ${f.id_foto}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        loading="lazy"
                                        onError={(e) => {
                                          // Fallback: replace with Nome_Foto text and broken-image styling
                                          const img = e.target as HTMLImageElement
                                          img.style.display = 'none'
                                          const parent = img.parentElement
                                          if (parent && !parent.querySelector('.foto-fallback')) {
                                            const fallback = document.createElement('div')
                                            fallback.className = 'foto-fallback absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-2 text-center'
                                            fallback.textContent = 'Falha ao carregar'
                                            parent.appendChild(fallback)
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                                        Sem URL
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={toImageUrl(lightbox.Loc_Foto) ?? ''}
            alt={lightbox.Nome_Foto ?? `Foto ${lightbox.id_foto}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
