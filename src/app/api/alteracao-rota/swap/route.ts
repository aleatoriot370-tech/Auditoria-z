import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { swapAgendaDates } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/alteracao-rota/swap
 * Swap dates between two agendas.
 *
 * Body: { id_agenda_1: number, id_agenda_2: number }
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id_agenda_1, id_agenda_2 } = body ?? {}

    if (!id_agenda_1 || !id_agenda_2) {
      return NextResponse.json(
        { erro: 'id_agenda_1 e id_agenda_2 são obrigatórios.' },
        { status: 400 }
      )
    }

    if (Number(id_agenda_1) === Number(id_agenda_2)) {
      return NextResponse.json(
        { erro: 'As duas agendas devem ser diferentes.' },
        { status: 400 }
      )
    }

    await swapAgendaDates(Number(id_agenda_1), Number(id_agenda_2))

    return NextResponse.json({ sucesso: true, mensagem: `Datas das agendas #${id_agenda_1} e #${id_agenda_2} trocadas com sucesso.` })
  } catch (err: any) {
    const knownCodes = ['AGENDA_NOT_FOUND', 'AGENDA_FINALIZED', 'VISITAS_NOT_PENDENTE', 'MISSING_DATE', 'SAME_AGENDA', 'DIFFERENT_VENDORS']
    if (knownCodes.includes(err.code)) {
      return NextResponse.json({ erro: err.message, code: err.code }, { status: 409 })
    }
    console.error('[alteracao-rota/swap] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao trocar datas: ' + err.message },
      { status: 500 }
    )
  }
}
