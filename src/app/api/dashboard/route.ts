import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getDashboardStats,
  getDailyAgendaVsAuditoria,
  getStatusCounts,
  getRecentAuditorias,
} from '@/lib/datasource'
import type { DashboardFilters } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const filters: DashboardFilters = {
    mes_referencia: url.searchParams.get('mes_referencia') || undefined,
    data_inicio: url.searchParams.get('data_inicio') || undefined,
    data_fim: url.searchParams.get('data_fim') || undefined,
    id_gerente: url.searchParams.get('id_gerente') ? Number(url.searchParams.get('id_gerente')) : undefined,
    id_vendedor: url.searchParams.get('id_vendedor') ? Number(url.searchParams.get('id_vendedor')) : undefined,
  }

  // If user is Comercial, force id_gerente filter to their own id
  if (session.Tipo === 'Comercial') {
    filters.id_gerente = session.id_user
  }

  try {
    const [stats, daily, statusCounts, recent] = await Promise.all([
      getDashboardStats(filters),
      getDailyAgendaVsAuditoria(filters),
      getStatusCounts(filters),
      getRecentAuditorias(filters),
    ])
    return NextResponse.json({ stats, daily, statusCounts, recent })
  } catch (err: any) {
    console.error('[dashboard] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao carregar dashboard: ' + err.message },
      { status: 500 }
    )
  }
}
