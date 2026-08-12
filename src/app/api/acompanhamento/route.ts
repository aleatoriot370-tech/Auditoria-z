import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isSupabaseEnabled, localDateToYMD } from '@/lib/datasource'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

interface AcompanhamentoResponse {
  stats: {
    total_agendas: number
    auditorias_realizadas: number
    visitas_agendadas: number
    visitas_realizadas: number
    eficiencia: number
    total_horas: string
  }
  weekly: { semana: string; agendadas: number; realizadas: number }[]
  statusCounts: { status: string; total: number }[]
  monthly6: { mes: string; agendadas: number; realizadas: number }[]
  daily: DayRow[]
}

/** Convert "MM-YYYY" → Date of first day of month (local time). */
function mesReferenciaToDate(mr: string): Date | null {
  const m = mr.match(/^(\d{2})-(\d{4})$/)
  if (!m) return null
  return new Date(Number(m[2]), Number(m[1]) - 1, 1)
}

/** Format a Date as "MM-YYYY" using LOCAL components. */
function dateToMesReferencia(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

/**
 * Calculate the week-of-month (1..5) for a given day number.
 *
 * ⚠️ This is the SAME formula used by pandas:
 *   semana = (day - 1) // 7 + 1
 *
 * Examples:
 *   day=1..7   → semana 1
 *   day=8..14  → semana 2
 *   day=15..21  → semana 3
 *   day=22..28  → semana 4
 *   day=29..31  → semana 5
 *
 * This is independent of the weekday — it's a pure calendar-week split.
 */
function getWeekOfMonthFromDay(day: number): number {
  return Math.floor((day - 1) / 7) + 1
}

/** Parse any date representation (Date, ISO string, "YYYY-MM-DD") → day-of-month (1..31). Returns null if invalid. */
function getDayOfMonth(value: any): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getDate()
  }
  if (typeof value === 'string') {
    // Try "YYYY-MM-DD" first (slice(8,10) gives the day)
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return Number(m[3])
    // Try ISO datetime
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.getDate()
  }
  if (typeof value === 'number') {
    // Could be a timestamp
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.getDate()
  }
  return null
}

/** Parse any date representation → YYYY-MM-DD string (local time). Returns null if invalid. */
function toDateYMD(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return localDateToYMD(value)
  }
  if (typeof value === 'string') {
    // Already YYYY-MM-DD
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return value.slice(0, 10)
    // Try ISO datetime → parse
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return localDateToYMD(d)
  }
  return null
}

/** Sum "HH:MM" strings → returns "HH:MM" (or "HHH:MM" if total ≥ 100h). */
function sumHoras(horas: (string | null)[]): string {
  let totalMin = 0
  for (const h of horas) {
    if (!h) continue
    const parts = h.split(':').map(Number)
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) continue
    totalMin += parts[0] * 60 + parts[1]
  }
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  let mes_referencia = url.searchParams.get('mes_referencia') || ''
  let id_gerente = url.searchParams.get('id_gerente') ? Number(url.searchParams.get('id_gerente')) : undefined
  const id_vendedor = url.searchParams.get('id_vendedor') ? Number(url.searchParams.get('id_vendedor')) : undefined

  // Comercial user → force id_gerente = their own id
  if (session.Tipo === 'Comercial') {
    id_gerente = session.id_user
  }

  // Default to current month if not provided
  if (!mes_referencia) {
    const now = new Date()
    mes_referencia = dateToMesReferencia(now)
  }

  const monthDate = mesReferenciaToDate(mes_referencia)
  if (!monthDate) {
    return NextResponse.json({ erro: 'mes_referencia inválido (use MM-YYYY)' }, { status: 400 })
  }

  try {
    // Fetch all agendas matching mes_referencia (+ optional gerente/vendedor filters)
    const agendas = await fetchAgendas(mes_referencia, id_gerente, id_vendedor)
    const agendaIds = agendas.map((a: any) => a.id_agenda)

    // Fetch all visitas for these agendas
    const visitas = agendaIds.length > 0 ? await fetchVisitas(agendaIds) : []

    // Build a map: id_agenda → agenda (for quick lookup)
    const agendaById = new Map<number, any>()
    for (const a of agendas) {
      agendaById.set(a.id_agenda, a)
    }

    // Build a map: id_agenda → { total, realizadas, canceladas }
    const visitasByAgenda = new Map<number, { total: number; realizadas: number; canceladas: number }>()
    for (const v of visitas) {
      const id_a = v.id_a
      if (id_a == null) continue
      const cur = visitasByAgenda.get(id_a) ?? { total: 0, realizadas: 0, canceladas: 0 }
      cur.total++
      if (v.status_atendimento === 'Realizado') cur.realizadas++
      if (v.status_atendimento === 'Cancelado') cur.canceladas++
      visitasByAgenda.set(id_a, cur)
    }

    // === STATS ===
    const total_agendas = agendas.length
    const auditorias_realizadas = agendas.filter((a: any) => a.status_atual === 'Finalizado').length
    const visitas_agendadas = visitas.length
    const visitas_realizadas = visitas.filter((v: any) => v.status_atendimento === 'Realizado').length
    const eficiencia = visitas_agendadas > 0 ? (visitas_realizadas / visitas_agendadas) * 100 : 0
    const total_horas_arr = agendas.map((a: any) => a.total_hora).filter(Boolean)
    const total_horas = sumHoras(total_horas_arr)

    // === WEEKLY (semana 1..5 do mês) ===
    // ⚠️ Use the AGENDA's data_agenda (not the visita's timestamp) to determine the week.
    // This way, all visitas of an agenda are counted in the week of the agenda's date,
    // regardless of whether individual visitas have data_hora_atendimento_inicio set.
    const weeklyMap = new Map<number, { agendadas: number; realizadas: number }>()
    for (let w = 1; w <= 5; w++) weeklyMap.set(w, { agendadas: 0, realizadas: 0 })
    for (const v of visitas) {
      const id_a = v.id_a
      if (id_a == null) continue
      const agenda = agendaById.get(id_a)
      if (!agenda) continue
      const agendaDateStr = toDateYMD(agenda.data_agenda)
      if (!agendaDateStr) continue
      const day = getDayOfMonth(agendaDateStr)
      if (day == null) continue
      const week = getWeekOfMonthFromDay(day)
      const cur = weeklyMap.get(week) ?? { agendadas: 0, realizadas: 0 }
      cur.agendadas++
      if (v.status_atendimento === 'Realizado') cur.realizadas++
      weeklyMap.set(week, cur)
    }
    const weekly = Array.from(weeklyMap.entries()).map(([w, v]) => ({
      semana: `Sem ${w}`,
      agendadas: v.agendadas,
      realizadas: v.realizadas,
    }))

    // === STATUS COUNTS (for bar chart) ===
    const statusMap = new Map<string, number>()
    for (const v of visitas) {
      const s = v.status_atendimento ?? 'Pendente'
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
    }
    const statusCounts = Array.from(statusMap.entries()).map(([status, total]) => ({ status, total }))

    // === LAST 6 MONTHS (line chart) ===
    const monthly6: { mes: string; agendadas: number; realizadas: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth() - i, 1)
      const mr = dateToMesReferencia(d)
      const monthAgendas = await fetchAgendas(mr, id_gerente, id_vendedor)
      const monthAgendaIds = monthAgendas.map((a: any) => a.id_agenda)
      const monthVisitas = monthAgendaIds.length > 0 ? await fetchVisitas(monthAgendaIds) : []
      const ag = monthVisitas.length
      const real = monthVisitas.filter((v: any) => v.status_atendimento === 'Realizado').length
      monthly6.push({
        mes: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`,
        agendadas: ag,
        realizadas: real,
      })
    }

    // === DAILY TABLE ===
    // For each agenda, compute its day's row.
    // The day is taken from agenda.data_agenda (NOT from visita timestamps).
    // Visitas counts come from visitasByAgenda map.
    const dailyMap = new Map<string, {
      id_agenda: number | null
      total_visitas: number
      realizadas: number
      canceladas: number
      status_atual: string | null
      total_hora: string | null
    }>()

    for (const a of agendas) {
      const dateStr = toDateYMD(a.data_agenda)
      if (!dateStr) continue
      const v = visitasByAgenda.get(a.id_agenda) ?? { total: 0, realizadas: 0, canceladas: 0 }
      const cur = dailyMap.get(dateStr) ?? {
        id_agenda: null,
        total_visitas: 0,
        realizadas: 0,
        canceladas: 0,
        status_atual: null,
        total_hora: null,
      }
      // Merge: there might be multiple agendas on the same day
      cur.id_agenda = a.id_agenda
      cur.total_visitas += v.total
      cur.realizadas += v.realizadas
      cur.canceladas += v.canceladas
      cur.status_atual = a.status_atual
      cur.total_hora = a.total_hora
      dailyMap.set(dateStr, cur)
    }

    // Build final daily array, sorted by date
    const daily: DayRow[] = Array.from(dailyMap.entries())
      .map(([data, v]) => ({
        data,
        total_visitas: v.total_visitas,
        realizadas: v.realizadas,
        canceladas: v.canceladas,
        eficiencia: v.total_visitas > 0 ? (v.realizadas / v.total_visitas) * 100 : 0,
        total_hora: v.total_hora,
        status_atual: v.status_atual,
        id_agenda: v.id_agenda,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))

    return NextResponse.json({
      stats: {
        total_agendas,
        auditorias_realizadas,
        visitas_agendadas,
        visitas_realizadas,
        eficiencia,
        total_horas,
      },
      weekly,
      statusCounts,
      monthly6,
      daily,
    } as AcompanhamentoResponse)
  } catch (err: any) {
    console.error('[acompanhamento] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao carregar acompanhamento: ' + err.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helpers — fetch agendas + visitas from Supabase or Prisma
// ============================================================================

async function fetchAgendas(mes_referencia: string, id_gerente?: number, id_vendedor?: number): Promise<any[]> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const sb = getSupabaseAdmin()
    let q = sb.from('ag_agenda').select('*').eq('mes_referencia', mes_referencia)
    if (id_gerente) q = q.eq('id_gerente', id_gerente)
    if (id_vendedor) q = q.eq('id_vendedor', id_vendedor)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  }
  // Prisma
  const where: any = { mes_referencia }
  if (id_gerente) where.id_gerente = id_gerente
  if (id_vendedor) where.id_vendedor = id_vendedor
  const rows = await db.ag_agenda.findMany({ where })
  // Normalize dates to local YYYY-MM-DD
  return rows.map((r: any) => ({
    ...r,
    data_agenda: r.data_agenda instanceof Date ? localDateToYMD(r.data_agenda) : r.data_agenda,
  }))
}

async function fetchVisitas(agendaIds: number[]): Promise<any[]> {
  if (agendaIds.length === 0) return []
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('@/lib/supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('ag_agenda_diaria')
      .select('*, cliente:Clientes(Razao)')
      .in('id_a', agendaIds)
    if (error) throw error
    return data ?? []
  }
  // Prisma
  const rows = await db.ag_agenda_diaria.findMany({
    where: { id_a: { in: agendaIds } },
    include: { Clientes: { select: { Razao: true } } },
  })
  return rows.map((r: any) => ({
    ...r,
    data_hora_atendimento_inicio: r.data_hora_atendimento_inicio instanceof Date
      ? r.data_hora_atendimento_inicio.toISOString()
      : r.data_hora_atendimento_inicio,
    data_hora_atendimento_fim: r.data_hora_atendimento_fim instanceof Date
      ? r.data_hora_atendimento_fim.toISOString()
      : r.data_hora_atendimento_fim,
    cliente: r.Clientes ? { Razao: r.Clientes.Razao } : null,
    Clientes: undefined,
  }))
}
