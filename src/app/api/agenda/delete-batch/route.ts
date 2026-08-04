import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deleteAgendas } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  if (!['Admin Senior', 'Admin Junior'].includes(session.Tipo ?? '')) {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas administradores podem excluir agendas.' },
      { status: 403 }
    )
  }

  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ erro: 'Lista de IDs ausente.' }, { status: 400 })
    }

    await deleteAgendas(ids.map(Number))
    return NextResponse.json({ sucesso: true, excluidas: ids.length })
  } catch (err: any) {
    console.error('[agenda/delete-batch] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao excluir agendas: ' + err.message },
      { status: 500 }
    )
  }
}
