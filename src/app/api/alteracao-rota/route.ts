import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { changeAgendaDate } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/alteracao-rota
 * Change the date of a single agenda.
 *
 * Body: { id_agenda: number, nova_data: string (YYYY-MM-DD) }
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id_agenda, nova_data } = body ?? {}

    if (!id_agenda || !nova_data) {
      return NextResponse.json(
        { erro: 'id_agenda e nova_data são obrigatórios.' },
        { status: 400 }
      )
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nova_data)) {
      return NextResponse.json(
        { erro: 'Formato de data inválido. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    await changeAgendaDate(Number(id_agenda), nova_data)

    return NextResponse.json({ sucesso: true, mensagem: `Data da agenda #${id_agenda} alterada para ${nova_data.split('-').reverse().join('/')}.` })
  } catch (err: any) {
    const knownCodes = ['AGENDA_NOT_FOUND', 'AGENDA_FINALIZED', 'VISITAS_NOT_PENDENTE', 'DATE_IN_PAST', 'DUPLICATE_DATE']
    if (knownCodes.includes(err.code)) {
      return NextResponse.json({ erro: err.message, code: err.code }, { status: 409 })
    }
    console.error('[alteracao-rota/PATCH] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao alterar data: ' + err.message },
      { status: 500 }
    )
  }
}
