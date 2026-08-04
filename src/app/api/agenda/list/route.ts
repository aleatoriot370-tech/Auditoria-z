import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listAgendas } from '@/lib/datasource'
import { listActiveUsersByTipos, getUserById } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const tipo = (url.searchParams.get('tipo') || 'data') as 'data' | 'mes_referencia'
  const data_inicio = url.searchParams.get('data_inicio') || undefined
  const data_fim = url.searchParams.get('data_fim') || undefined
  const mes_referencia = url.searchParams.get('mes_referencia') || undefined
  let id_gerente = url.searchParams.get('id_gerente') ? Number(url.searchParams.get('id_gerente')) : undefined
  const id_vendedor = url.searchParams.get('id_vendedor') ? Number(url.searchParams.get('id_vendedor')) : undefined

  // Comercial users act as their own id_gerente filter
  if (session.Tipo === 'Comercial') {
    id_gerente = session.id_user
  }

  try {
    const agendas = await listAgendas({
      tipo,
      data_inicio,
      data_fim,
      mes_referencia,
      id_gerente,
      id_vendedor,
    })

    // Build filter dropdowns (gestores and vendedores actually used in the returned agendas)
    const gerenteIds = new Set<number>()
    const vendedorIds = new Set<number>()
    agendas.forEach((a) => {
      if (a.id_gerente) gerenteIds.add(a.id_gerente)
      if (a.id_vendedor) vendedorIds.add(a.id_vendedor)
    })

    const gestores = await Promise.all(Array.from(gerenteIds).map((id) => getUserById(id)))
    const vendedores = await Promise.all(Array.from(vendedorIds).map((id) => getUserById(id)))

    return NextResponse.json({
      agendas,
      gestores: gestores.filter(Boolean).map((u) => ({ id_user: u!.id_user, Nome: u!.Nome })),
      vendedores: vendedores.filter(Boolean).map((u) => ({ id_user: u!.id_user, Nome: u!.Nome })),
      isComercial: session.Tipo === 'Comercial',
      canDelete: ['Admin Senior', 'Admin Junior'].includes(session.Tipo ?? ''),
    })
  } catch (err: any) {
    console.error('[agenda/list] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar agendas: ' + err.message },
      { status: 500 }
    )
  }
}
