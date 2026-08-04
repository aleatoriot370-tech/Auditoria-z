import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listActiveUsersByTipos, listAgendas } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  // Get filters to scope the gestores list to the current period
  const tipo = (url.searchParams.get('tipo') || 'data') as 'data' | 'mes_referencia'
  const data_inicio = url.searchParams.get('data_inicio') || undefined
  const data_fim = url.searchParams.get('data_fim') || undefined
  const mes_referencia = url.searchParams.get('mes_referencia') || undefined
  const id_vendedor = url.searchParams.get('id_vendedor') ? Number(url.searchParams.get('id_vendedor')) : undefined

  let id_gerente_filter: number | undefined
  if (session.Tipo === 'Comercial') {
    id_gerente_filter = session.id_user
  }

  try {
    const agendas = await listAgendas({
      tipo,
      data_inicio,
      data_fim,
      mes_referencia,
      id_gerente: id_gerente_filter,
      id_vendedor,
    })

    // Build a unique map of vendedores in the returned agendas
    const vendedorIds = new Set<number>()
    agendas.forEach((a) => {
      if (a.id_vendedor) vendedorIds.add(a.id_vendedor)
    })

    // Fetch each vendedor's name — use listActiveUsersByTipos for the full list
    const allComercial = await listActiveUsersByTipos(['Comercial'])
    const inPeriod = allComercial.filter((u) => vendedorIds.has(u.id_user))

    return NextResponse.json({
      vendedores: inPeriod.map((u) => ({ id_user: u.id_user, Nome: u.Nome })),
    })
  } catch (err: any) {
    console.error('[users/vendedores-in-period] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar vendedores: ' + err.message },
      { status: 500 }
    )
  }
}
