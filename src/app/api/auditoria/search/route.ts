import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findAgendaByDateAndVendedor, getVisitasByAgendaId } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const data_agenda = url.searchParams.get('data_agenda')
  const id_vendedor = url.searchParams.get('id_vendedor')

  if (!data_agenda || !id_vendedor) {
    return NextResponse.json(
      { erro: 'data_agenda e id_vendedor são obrigatórios.' },
      { status: 400 }
    )
  }

  try {
    const agenda = await findAgendaByDateAndVendedor(data_agenda, Number(id_vendedor))
    if (!agenda) {
      return NextResponse.json({ encontrado: false, mensagem: 'Agenda não localizada para o dia informado.' })
    }

    const visitas = await getVisitasByAgendaId(agenda.id_agenda)

    // Compute counts
    const total = visitas.length
    const pendente = visitas.filter((v) => v.status_atendimento === 'Pendente').length
    const pendente_aud = visitas.filter((v) => v.status_atendimento === 'Pendente Auditoria').length
    const realizado = visitas.filter((v) => v.status_atendimento === 'Realizado').length
    const cancelado = visitas.filter((v) => v.status_atendimento === 'Cancelado').length

    // AUDITORIA RULE:
    //   - Today or future date → BLOCKED (visits haven't happened yet, cannot audit)
    //   - Past date → ALLOWED (visits should have happened, can be audited)
    //   - Already finalized → BLOCKED (read-only view)
    const today = new Date().toISOString().slice(0, 10)
    const agendaDate = (agenda.data_agenda ?? '').slice(0, 10)
    const isFinalized = agenda.status_atual === 'Finalizado'
    const isTodayOrFuture = agendaDate >= today  // ← today or future
    const readOnly = isFinalized || isTodayOrFuture

    return NextResponse.json({
      encontrado: true,
      agenda,
      visitas,
      counts: { total, pendente, pendente_aud, realizado, cancelado },
      readOnly,
      readOnlyReason: isFinalized
        ? 'Agenda já auditada (somente visualização).'
        : isTodayOrFuture
        ? 'A auditoria só pode ser realizada após a data da agenda (somente visualização).'
        : null,
    })
  } catch (err: any) {
    console.error('[auditoria/search] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao buscar agenda: ' + err.message },
      { status: 500 }
    )
  }
}
