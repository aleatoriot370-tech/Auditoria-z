import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAgendaById, getVisitasByAgendaId, updateAgendaVisitas } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const id_agenda = Number(id)
  if (Number.isNaN(id_agenda)) {
    return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })
  }

  try {
    const agenda = await getAgendaById(id_agenda)
    if (!agenda) {
      return NextResponse.json({ erro: 'Agenda não encontrada.' }, { status: 404 })
    }
    const visitas = await getVisitasByAgendaId(id_agenda)
    const canEdit = ['Admin Senior', 'Admin Junior'].includes(session.Tipo ?? '') && agenda.status_atual === 'Pendente'

    return NextResponse.json({ agenda, visitas, canEdit })
  } catch (err: any) {
    console.error('[agenda/[id]/GET] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao buscar agenda: ' + err.message },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  if (!['Admin Senior', 'Admin Junior'].includes(session.Tipo ?? '')) {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas administradores podem editar agendas.' },
      { status: 403 }
    )
  }

  const { id } = await params
  const id_agenda = Number(id)
  if (Number.isNaN(id_agenda)) {
    return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { keep_visit_ids, add_codigos } = body ?? {}

    // Verify agenda is pending
    const agenda = await getAgendaById(id_agenda)
    if (!agenda) {
      return NextResponse.json({ erro: 'Agenda não encontrada.' }, { status: 404 })
    }
    if (agenda.status_atual !== 'Pendente') {
      return NextResponse.json(
        { erro: 'Apenas agendas Pendentes podem ser editadas.' },
        { status: 400 }
      )
    }

    // Atomic update: delete visits not in keep_visit_ids + add new visits from add_codigos.
    // Validation of new codes happens inside updateAgendaVisitas.
    await updateAgendaVisitas(
      id_agenda,
      Array.isArray(keep_visit_ids) ? keep_visit_ids.map(Number) : [],
      Array.isArray(add_codigos) ? add_codigos.map(Number) : []
    )

    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    console.error('[agenda/[id]/PATCH] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao atualizar agenda: ' + err.message },
      { status: 500 }
    )
  }
}
