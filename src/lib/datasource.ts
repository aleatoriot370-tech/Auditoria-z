import bcrypt from 'bcryptjs'
import { isSupabaseEnabled } from './supabase'
import { db } from './db'
import type {
  User,
  Cliente,
  Agenda,
  AgendaDiaria,
  AgendaWithJoins,
  DashboardFilters,
  DashboardStats,
  DailyPoint,
  StatusCount,
  AuditoriaRow,
} from './types'

/**
 * Unified data source abstraction.
 *
 * - When Supabase env vars are set → routes all calls to Supabase via REST.
 * - Otherwise → uses local Prisma/SQLite (sandbox preview).
 *
 * This lets the same codebase run in the sandbox AND in production on Netlify.
 */

// ============================================================================
// AUTH
// ============================================================================

export async function findUserByLogin(login: string): Promise<User | null> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    // ⚠️ Fetch ALL rows with this login (Login column may not be UNIQUE in legacy DBs).
    // Then prefer the first one whose Status is 'a' (case-insensitive, trimmed).
    // This prevents the original `LIMIT 1` non-deterministic bug where an inactive
    // row could be returned even when an active row with the same login exists.
    const { data, error } = await sb
      .from('Users')
      .select('*')
      .eq('Login', login)
    if (error) throw error
    const rows = (data as User[]) ?? []
    if (rows.length === 0) return null
    // Prefer active user; if none active, return the first one (which will fail the
    // Status check below — same UX as before, but now the active one is preferred).
    const active = rows.find((u) => (u.Status ?? '').trim().toLowerCase() === 'a')
    return active ?? rows[0]
  }
  // Prisma (sandbox) — Login is unique here, so findFirst is safe.
  return (await db.users.findFirst({ where: { Login: login } })) as unknown as User | null
}

/**
 * Mirrors the Postgres `validar_login` function behaviour:
 * - Returns generic error if login not found
 * - Returns "inativo" if Status != 'a'
 * - Verifies bcrypt hash ($2a/$2b/$2y), normalizing $2b/$2y to $2a
 * - Falls back to plaintext compare for legacy rows
 * - Migrates plaintext to bcrypt $2a$ on success
 * - NEVER returns the password
 */
export async function validateLogin(login: string, senha: string): Promise<{
  sucesso: boolean
  mensagem?: string
  usuario?: Omit<User, 'Senha'>
}> {
  const user = await findUserByLogin(login)

  if (!user) {
    return { sucesso: false, mensagem: 'Login e senha inválidos.' }
  }
  // ⚠️ Robust Status check — trim whitespace + case-insensitive.
  // Handles DB values like 'A', 'a ', ' a' that would fail the original strict `!== 'a'` check.
  const statusNorm = (user.Status ?? '').trim().toLowerCase()
  if (statusNorm !== 'a') {
    return { sucesso: false, mensagem: 'Usuário inativo. Contate o administrador.' }
  }

  const allowedTypes = ['Admin Senior', 'Admin Junior', 'Comercial']
  if (!allowedTypes.includes(user.Tipo ?? '')) {
    return { sucesso: false, mensagem: 'Usuário não autorizado, entre em contato com o administrador.' }
  }

  let is_valid = false
  const stored = user.Senha ?? ''
  if (/^\$2[aby]\$/.test(stored)) {
    // bcrypt hash — normalize $2b/$2y to $2a for bcryptjs compatibility
    const normalized = stored.replace(/^\$2[by]\$/, '$2a$')
    try {
      is_valid = await bcrypt.compare(senha, normalized)
    } catch {
      is_valid = false
    }
  } else {
    // legacy plaintext
    is_valid = stored === senha
  }

  if (!is_valid) {
    return { sucesso: false, mensagem: 'Login e senha inválidos.' }
  }

  // migrate plaintext to bcrypt
  if (!/^\$2[aby]\$/.test(stored)) {
    const newHash = await bcrypt.hash(senha, 10)
    await updateUserPassword(user.id_user, newHash)
  }

  const { Senha: _omit, ...safeUser } = user
  return { sucesso: true, usuario: safeUser }
}

async function updateUserPassword(id_user: number, newHash: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { error } = await sb.from('Users').update({ Senha: newHash }).eq('id_user', id_user)
    if (error) throw error
    return
  }
  await db.users.update({ where: { id_user }, data: { Senha: newHash } })
}

// ============================================================================
// USERS
// ============================================================================

export async function listActiveUsersByTipos(tipos: string[]): Promise<User[]> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    // ⚠️ Use a case-insensitive match (ilike) and trim whitespace in-app to also
    // catch rows with Status='A' / 'a ' that the original `.eq('Status', 'a')` would miss.
    const { data, error } = await sb
      .from('Users')
      .select('*')
      .in('Tipo', tipos)
      .order('Nome')
    if (error) throw error
    return ((data as User[]) ?? []).filter(
      (u) => (u.Status ?? '').trim().toLowerCase() === 'a'
    )
  }
  // Prisma (sandbox) — SQLite case-insensitive by default for =, but normalize anyway
  const rows = (await db.users.findMany({
    where: { Status: 'a', Tipo: { in: tipos } },
    orderBy: { Nome: 'asc' },
  })) as unknown as User[]
  return rows.filter((u) => (u.Status ?? '').trim().toLowerCase() === 'a')
}

export async function getUserById(id_user: number): Promise<User | null> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('Users')
      .select('*')
      .eq('id_user', id_user)
      .maybeSingle()
    if (error) throw error
    return (data as User) ?? null
  }
  return (await db.users.findUnique({ where: { id_user } })) as unknown as User | null
}

// ============================================================================
// CLIENTES
// ============================================================================

export async function findClienteByCodigo(codigo: number): Promise<Cliente | null> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('Clientes')
      .select('*')
      .eq('Codigo', codigo)
      .maybeSingle()
    if (error) throw error
    return (data as Cliente) ?? null
  }
  const row = await db.clientes.findUnique({ where: { Codigo: codigo } }) as any
  if (!row) return null
  return { ...row, CNPJ_CPF: row.CNPJ_CPF != null ? row.CNPJ_CPF.toString() : null } as Cliente
}

export async function findClientesByCodigos(codigos: number[]): Promise<Cliente[]> {
  if (codigos.length === 0) return []
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('Clientes')
      .select('*')
      .in('Codigo', codigos)
    if (error) throw error
    return (data as Cliente[]) ?? []
  }
  const rows = await db.clientes.findMany({ where: { Codigo: { in: codigos } } }) as any[]
  return rows.map((r) => ({ ...r, CNPJ_CPF: r.CNPJ_CPF != null ? r.CNPJ_CPF.toString() : null })) as Cliente[]
}

// ============================================================================
// AGENDA - CRUD
// ============================================================================

export async function createAgendaWithVisitas(payload: {
  id_gerente: number
  id_vendedor: number
  data_agenda: string // YYYY-MM-DD
  placa: string
  mes_referencia: string // MM-YYYY
  visitas: { id_clientes: number; data_hora_atendimento?: string }[]
}): Promise<number> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('ag_agenda')
      .insert({
        id_gerente: payload.id_gerente,
        id_vendedor: payload.id_vendedor,
        data_agenda: payload.data_agenda,
        placa: payload.placa,
        mes_referencia: payload.mes_referencia,
        status_atual: 'Pendente',
        data_criacao: new Date().toISOString(),
      })
      .select('id_agenda')
      .single()
    if (error) throw error
    const id_agenda = (data as { id_agenda: number }).id_agenda

    if (payload.visitas.length > 0) {
      const rows = payload.visitas.map((v) => ({
        id_a: id_agenda,
        id_clientes: v.id_clientes,
        status_atendimento: 'Pendente',
        data_hora_atendimento: v.data_hora_atendimento ?? null,
      }))
      const { error: err2 } = await sb.from('ag_agenda_diaria').insert(rows)
      if (err2) throw err2
    }
    return id_agenda
  }

  // Prisma
  const created = await db.ag_agenda.create({
    data: {
      id_gerente: payload.id_gerente,
      id_vendedor: payload.id_vendedor,
      data_agenda: new Date(payload.data_agenda + 'T00:00:00'),
      placa: payload.placa,
      mes_referencia: payload.mes_referencia,
      status_atual: 'Pendente',
      data_criacao: new Date(),
      ag_agenda_diaria: {
        create: payload.visitas.map((v) => ({
          id_clientes: v.id_clientes,
          status_atendimento: 'Pendente',
          data_hora_atendimento: v.data_hora_atendimento ? new Date(v.data_hora_atendimento) : null,
        })),
      },
    },
  })
  return created.id_agenda
}

export async function getAgendaById(id_agenda: number): Promise<AgendaWithJoins | null> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('ag_agenda')
      .select(`
        *,
        gerente:Users!ag_agenda_id_gerente_fkey(id_user,Nome),
        vendedor:Users!ag_agenda_id_vendedor_fkey(id_user,Nome),
        auditor:Users(id_user,Nome)
      `)
      .eq('id_agenda', id_agenda)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return normalizeAgenda(data as any)
  }
  const row = await db.ag_agenda.findUnique({
    where: { id_agenda },
    include: {
      Users_UsersToag_agenda_id_gerente: { select: { id_user: true, Nome: true } },
      Users_UsersToag_agenda_id_vendedor: { select: { id_user: true, Nome: true } },
    },
  })
  if (!row) return null
  const { Users_UsersToag_agenda_id_gerente, Users_UsersToag_agenda_id_vendedor, ...rest } = row as any
  return normalizeAgenda({
    ...rest,
    gerente: Users_UsersToag_agenda_id_gerente,
    vendedor: Users_UsersToag_agenda_id_vendedor,
  })
}

export async function getVisitasByAgendaId(id_a: number): Promise<AgendaDiaria[]> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('ag_agenda_diaria')
      .select(`*, cliente:Clientes(*)`)
      .eq('id_a', id_a)
      .order('id_ad')
    if (error) throw error
    return (data as AgendaDiaria[]) ?? []
  }
  const rows = await db.ag_agenda_diaria.findMany({
    where: { id_a },
    include: {
      Clientes: { select: { Codigo: true, Razao: true, Bairro: true, Cidade: true, UF: true } },
    },
    orderBy: { id_ad: 'asc' },
  })
  return rows.map((r: any) => ({
    ...r,
    data_hora_atendimento: r.data_hora_atendimento instanceof Date
      ? r.data_hora_atendimento.toISOString()
      : r.data_hora_atendimento,
    cliente: r.Clientes,
    Clientes: undefined,
  })) as unknown as AgendaDiaria[]
}

export async function findAgendaByDateAndVendedor(data_agenda: string, id_vendedor: number): Promise<AgendaWithJoins | null> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const start = `${data_agenda}T00:00:00`
    const end = `${data_agenda}T23:59:59`
    const { data, error } = await sb
      .from('ag_agenda')
      .select(`
        *,
        gerente:Users!ag_agenda_id_gerente_fkey(id_user,Nome),
        vendedor:Users!ag_agenda_id_vendedor_fkey(id_user,Nome),
        auditor:Users(id_user,Nome)
      `)
      .eq('id_vendedor', id_vendedor)
      .gte('data_agenda', start)
      .lte('data_agenda', end)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return normalizeAgenda(data as any)
  }
  // Prisma - SQLite stores DateTime, so compare date range
  const start = new Date(`${data_agenda}T00:00:00`)
  const end = new Date(`${data_agenda}T23:59:59`)
  const row = await db.ag_agenda.findFirst({
    where: { id_vendedor, data_agenda: { gte: start, lte: end } },
    include: {
      Users_UsersToag_agenda_id_gerente: { select: { id_user: true, Nome: true } },
      Users_UsersToag_agenda_id_vendedor: { select: { id_user: true, Nome: true } },
    },
  })
  if (!row) return null
  const { Users_UsersToag_agenda_id_gerente, Users_UsersToag_agenda_id_vendedor, ...rest } = row as any
  return normalizeAgenda({
    ...rest,
    gerente: Users_UsersToag_agenda_id_gerente,
    vendedor: Users_UsersToag_agenda_id_vendedor,
  })
}

/** Normalize date fields across Prisma (Date) and Supabase (string) into ISO strings. */
function normalizeAgenda(row: any): AgendaWithJoins {
  return {
    ...row,
    data_criacao: row.data_criacao instanceof Date ? row.data_criacao.toISOString() : row.data_criacao,
    data_agenda: row.data_agenda instanceof Date ? row.data_agenda.toISOString().slice(0, 10) : row.data_agenda,
    data_aud: row.data_aud instanceof Date ? row.data_aud.toISOString().slice(0, 10) : row.data_aud,
  } as AgendaWithJoins
}

export async function saveAuditoria(payload: {
  id_agenda: number
  hora_inicial: string
  hora_fim: string
  total_hora: string
  almoco: string // 'S' | 'N'
  obs_geral?: string
  eficiencia: number
  id_auditor: number
  visitas: { id_ad: number; status_atendimento: string; observacao?: string }[]
}): Promise<void> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { error: e1 } = await sb
      .from('ag_agenda')
      .update({
        hora_inicial: payload.hora_inicial,
        hora_fim: payload.hora_fim,
        total_hora: payload.total_hora,
        almoco: payload.almoco,
        obs_geral: payload.obs_geral ?? null,
        eficiencia: payload.eficiencia,
        status_atual: 'Finalizado',
        id_auditor: payload.id_auditor,
        data_aud: new Date().toISOString().slice(0, 10),
      })
      .eq('id_agenda', payload.id_agenda)
    if (e1) throw e1

    for (const v of payload.visitas) {
      const { error } = await sb
        .from('ag_agenda_diaria')
        .update({
          status_atendimento: v.status_atendimento,
          observacao: v.observacao ?? null,
        })
        .eq('id_ad', v.id_ad)
      if (error) throw error
    }
    return
  }

  // Prisma — transaction
  await db.$transaction([
    db.ag_agenda.update({
      where: { id_agenda: payload.id_agenda },
      data: {
        hora_inicial: payload.hora_inicial,
        hora_fim: payload.hora_fim,
        total_hora: payload.total_hora,
        almoco: payload.almoco,
        obs_geral: payload.obs_geral ?? null,
        eficiencia: payload.eficiencia,
        status_atual: 'Finalizado',
        id_auditor: payload.id_auditor,
        data_aud: new Date(),
      },
    }),
    ...payload.visitas.map((v) =>
      db.ag_agenda_diaria.update({
        where: { id_ad: v.id_ad },
        data: {
          status_atendimento: v.status_atendimento,
          observacao: v.observacao ?? null,
        },
      })
    ),
  ])
}

export async function updateAgendaVisitas(id_agenda: number, visitasIds: number[]): Promise<void> {
  // Removes visitas (ag_agenda_diaria rows) NOT in visitasIds, no additions here
  // (the detail popup only allows exclusions per spec — additions are a separate path)
  if (visitasIds.length === 0) return
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { error } = await sb
      .from('ag_agenda_diaria')
      .delete()
      .eq('id_a', id_agenda)
      .not('id_ad', 'in', `(${visitasIds.join(',')})`)
    if (error) throw error
    return
  }
  await db.ag_agenda_diaria.deleteMany({
    where: { id_a: id_agenda, id_ad: { notIn: visitasIds } },
  })
}

export async function addVisitaToAgenda(id_agenda: number, id_clientes: number): Promise<void> {
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { error } = await sb
      .from('ag_agenda_diaria')
      .insert({ id_a: id_agenda, id_clientes, status_atendimento: 'Pendente' })
    if (error) throw error
    return
  }
  await db.ag_agenda_diaria.create({
    data: { id_a: id_agenda, id_clientes, status_atendimento: 'Pendente' },
  })
}

export async function deleteAgendas(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    // Cascade delete handled by FK ON DELETE CASCADE on ag_agenda_diaria
    const { error } = await sb.from('ag_agenda').delete().in('id_agenda', ids)
    if (error) throw error
    return
  }
  await db.ag_agenda.deleteMany({ where: { id_agenda: { in: ids } } })
}

// ============================================================================
// AGENDA LIST
// ============================================================================

export async function listAgendas(filters: {
  tipo: 'data' | 'mes_referencia'
  data_inicio?: string
  data_fim?: string
  mes_referencia?: string
  id_gerente?: number
  id_vendedor?: number
}): Promise<AgendaWithJoins[]> {
  const where: any = {}
  if (filters.tipo === 'data') {
    if (filters.data_inicio) where.data_agenda_gte = `${filters.data_inicio}T00:00:00`
    if (filters.data_fim) where.data_agenda_lte = `${filters.data_fim}T23:59:59`
  } else if (filters.mes_referencia) {
    where.mes_referencia = filters.mes_referencia
  }
  if (filters.id_gerente) where.id_gerente = filters.id_gerente
  if (filters.id_vendedor) where.id_vendedor = filters.id_vendedor

  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    let q = sb
      .from('ag_agenda')
      .select(`
        *,
        gerente:Users!ag_agenda_id_gerente_fkey(id_user,Nome),
        vendedor:Users!ag_agenda_id_vendedor_fkey(id_user,Nome)
      `)
      .order('data_agenda', { ascending: false })

    if (filters.tipo === 'data') {
      if (filters.data_inicio) q = q.gte('data_agenda', `${filters.data_inicio}T00:00:00`)
      if (filters.data_fim) q = q.lte('data_agenda', `${filters.data_fim}T23:59:59`)
    } else if (filters.mes_referencia) {
      q = q.eq('mes_referencia', filters.mes_referencia)
    }
    if (filters.id_gerente) q = q.eq('id_gerente', filters.id_gerente)
    if (filters.id_vendedor) q = q.eq('id_vendedor', filters.id_vendedor)

    const { data, error } = await q
    if (error) throw error
    const agendas = (data as AgendaWithJoins[]) ?? []

    // fetch total_visitas per agenda in one round-trip
    if (agendas.length > 0) {
      const ids = agendas.map((a) => a.id_agenda)
      const { data: visitas, error: e2 } = await sb
        .from('ag_agenda_diaria')
        .select('id_a, status_atendimento')
        .in('id_a', ids)
      if (e2) throw e2
      const map = new Map<number, { total: number; realizadas: number; canceladas: number }>()
      for (const v of visitas ?? []) {
        const id_a = (v as any).id_a as number
        const s = (v as any).status_atendimento as string
        const cur = map.get(id_a) ?? { total: 0, realizadas: 0, canceladas: 0 }
        cur.total++
        if (s === 'Realizado') cur.realizadas++
        if (s === 'Cancelado') cur.canceladas++
        map.set(id_a, cur)
      }
      agendas.forEach((a) => {
        const m = map.get(a.id_agenda)
        a.total_visitas = m?.total ?? 0
        a.visitas_realizadas = m?.realizadas ?? 0
        a.visitas_canceladas = m?.canceladas ?? 0
      })
    }
    return agendas
  }

  // Prisma
  const whereP: any = {}
  if (filters.tipo === 'data') {
    if (filters.data_inicio) whereP.data_agenda = { ...whereP.data_agenda, gte: new Date(`${filters.data_inicio}T00:00:00`) }
    if (filters.data_fim) whereP.data_agenda = { ...whereP.data_agenda, lte: new Date(`${filters.data_fim}T23:59:59`) }
  } else if (filters.mes_referencia) {
    whereP.mes_referencia = filters.mes_referencia
  }
  if (filters.id_gerente) whereP.id_gerente = filters.id_gerente
  if (filters.id_vendedor) whereP.id_vendedor = filters.id_vendedor

  const rows = await db.ag_agenda.findMany({
    where: whereP,
    orderBy: { data_agenda: 'desc' },
    include: {
      Users_UsersToag_agenda_id_gerente: { select: { id_user: true, Nome: true } },
      Users_UsersToag_agenda_id_vendedor: { select: { id_user: true, Nome: true } },
      _count: { select: { ag_agenda_diaria: true } },
    },
  })
  const ids = rows.map((r: any) => r.id_agenda)
  const visitas = ids.length > 0
    ? await db.ag_agenda_diaria.groupBy({
        by: ['id_a', 'status_atendimento'],
        where: { id_a: { in: ids } },
        _count: { _all: true },
      })
    : []
  const map = new Map<number, { total: number; realizadas: number; canceladas: number }>()
  for (const v of visitas as any[]) {
    const id = v.id_a
    const s = v.status_atendimento
    const cur = map.get(id) ?? { total: 0, realizadas: 0, canceladas: 0 }
    cur.total += v._count._all
    if (s === 'Realizado') cur.realizadas += v._count._all
    if (s === 'Cancelado') cur.canceladas += v._count._all
    map.set(id, cur)
  }
  return rows.map((r: any) => {
    const { Users_UsersToag_agenda_id_gerente, Users_UsersToag_agenda_id_vendedor, _count, ...rest } = r
    const m = map.get(r.id_agenda)
    return {
      ...rest,
      data_criacao: r.data_criacao instanceof Date ? r.data_criacao.toISOString() : r.data_criacao,
      data_agenda: r.data_agenda instanceof Date ? r.data_agenda.toISOString().slice(0, 10) : r.data_agenda,
      data_aud: r.data_aud instanceof Date ? r.data_aud.toISOString().slice(0, 10) : r.data_aud,
      gerente: Users_UsersToag_agenda_id_gerente,
      vendedor: Users_UsersToag_agenda_id_vendedor,
      total_visitas: m?.total ?? _count?.ag_agenda_diaria ?? 0,
      visitas_realizadas: m?.realizadas ?? 0,
      visitas_canceladas: m?.canceladas ?? 0,
    }
  }) as unknown as AgendaWithJoins[]
}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardStats> {
  const agendas = await listAgendas({
    tipo: filters.data_inicio || filters.data_fim ? 'data' : 'mes_referencia',
    data_inicio: filters.data_inicio,
    data_fim: filters.data_fim,
    mes_referencia: filters.mes_referencia,
    id_gerente: filters.id_gerente,
    id_vendedor: filters.id_vendedor,
  })

  const ids = agendas.map((a) => a.id_agenda)
  let visitas_agendadas = 0
  let visitas_realizadas = 0

  if (ids.length > 0) {
    if (isSupabaseEnabled()) {
      const { getSupabaseAdmin } = await import('./supabase')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('ag_agenda_diaria')
        .select('status_atendimento')
        .in('id_a', ids)
      if (error) throw error
      for (const v of (data ?? []) as any[]) {
        visitas_agendadas++
        if (v.status_atendimento === 'Realizado') visitas_realizadas++
      }
    } else {
      const rows = await db.ag_agenda_diaria.findMany({
        where: { id_a: { in: ids } },
        select: { status_atendimento: true },
      })
      for (const v of rows) {
        visitas_agendadas++
        if (v.status_atendimento === 'Realizado') visitas_realizadas++
      }
    }
  }

  return {
    total_agendas: agendas.length,
    auditorias_realizadas: agendas.filter((a) => a.status_atual === 'Finalizado').length,
    visitas_agendadas,
    visitas_realizadas,
  }
}

export async function getDailyAgendaVsAuditoria(filters: DashboardFilters): Promise<DailyPoint[]> {
  const agendas = await listAgendas({
    tipo: filters.data_inicio || filters.data_fim ? 'data' : 'mes_referencia',
    data_inicio: filters.data_inicio,
    data_fim: filters.data_fim,
    mes_referencia: filters.mes_referencia,
    id_gerente: filters.id_gerente,
    id_vendedor: filters.id_vendedor,
  })
  const map = new Map<string, DailyPoint>()
  for (const a of agendas) {
    const dateStr = (a.data_agenda ?? '').slice(0, 10)
    if (!dateStr) continue
    const p = map.get(dateStr) ?? { data: dateStr, agendas: 0, auditorias: 0 }
    p.agendas++
    if (a.status_atual === 'Finalizado') p.auditorias++
    map.set(dateStr, p)
  }
  return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data))
}

export async function getStatusCounts(filters: DashboardFilters): Promise<StatusCount[]> {
  const agendas = await listAgendas({
    tipo: filters.data_inicio || filters.data_fim ? 'data' : 'mes_referencia',
    data_inicio: filters.data_inicio,
    data_fim: filters.data_fim,
    mes_referencia: filters.mes_referencia,
    id_gerente: filters.id_gerente,
    id_vendedor: filters.id_vendedor,
  })
  const ids = agendas.map((a) => a.id_agenda)
  if (ids.length === 0) return []
  const map = new Map<string, number>()
  if (isSupabaseEnabled()) {
    const { getSupabaseAdmin } = await import('./supabase')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('ag_agenda_diaria')
      .select('status_atendimento')
      .in('id_a', ids)
    if (error) throw error
    for (const v of (data ?? []) as any[]) {
      const s = v.status_atendimento ?? 'Pendente'
      map.set(s, (map.get(s) ?? 0) + 1)
    }
  } else {
    const rows = await db.ag_agenda_diaria.findMany({
      where: { id_a: { in: ids } },
      select: { status_atendimento: true },
    })
    for (const v of rows) {
      const s = v.status_atendimento ?? 'Pendente'
      map.set(s, (map.get(s) ?? 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([status, total]) => ({ status, total }))
}

export async function getRecentAuditorias(filters: DashboardFilters): Promise<AuditoriaRow[]> {
  const agendas = await listAgendas({
    tipo: filters.data_inicio || filters.data_fim ? 'data' : 'mes_referencia',
    data_inicio: filters.data_inicio,
    data_fim: filters.data_fim,
    mes_referencia: filters.mes_referencia,
    id_gerente: filters.id_gerente,
    id_vendedor: filters.id_vendedor,
  })
  return agendas
    .filter((a) => a.status_atual === 'Finalizado')
    .sort((a, b) => (b.data_aud ?? '').localeCompare(a.data_aud ?? ''))
    .slice(0, 10)
    .map((a) => ({
      id_agenda: a.id_agenda,
      gerente: a.gerente?.Nome ?? '-',
      vendedor: a.vendedor?.Nome ?? '-',
      visitas_agendadas: a.total_visitas ?? 0,
      visitas_realizadas: a.visitas_realizadas ?? 0,
      visitas_canceladas: a.visitas_canceladas ?? 0,
      total_hora: a.total_hora,
      eficiencia: a.eficiencia,
      data_aud: a.data_aud,
    }))
}
