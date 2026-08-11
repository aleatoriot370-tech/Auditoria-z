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
    // Validation errors (finalized or non-Pendente agendas) → 409 Conflict.
    // Don't log expected business-rule errors to the console.
    if (err.code === 'AGENDA_FINALIZED' || err.code === 'AGENDA_HAS_NON_PENDENTE_VISITAS') {
      return NextResponse.json(
        { erro: err.message, code: err.code },
        { status: 409 }
      )
    }
    console.error('[agenda/delete-batch] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao excluir agendas: ' + err.message },
      { status: 500 }
    )
  }
}
