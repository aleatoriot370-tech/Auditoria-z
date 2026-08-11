import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createAgendaWithVisitas, findClientesByCodigos } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id_gerente, id_vendedor, data_agenda, placa, visitas } = body ?? {}

    if (!id_gerente || !id_vendedor || !data_agenda || !placa || !Array.isArray(visitas) || visitas.length === 0) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios ausentes (gestor, vendedor, data_agenda, placa, visitas).' },
        { status: 400 }
      )
    }

    // Validate all client codes exist
    const codigos = visitas.map((v: any) => Number(v.id_clientes))
    const found = await findClientesByCodigos(codigos)
    const foundCodes = new Set(found.map((c) => c.Codigo))
    const invalid = codigos.filter((c) => !foundCodes.has(c))
    if (invalid.length > 0) {
      return NextResponse.json(
        { erro: `Códigos de cliente não encontrados: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    // mes_referencia = MM-YYYY
    const [y, m] = data_agenda.split('-')
    const mes_referencia = `${m}-${y}`

    const id_agenda = await createAgendaWithVisitas({
      id_gerente: Number(id_gerente),
      id_vendedor: Number(id_vendedor),
      data_agenda,
      placa,
      mes_referencia,
      visitas: visitas.map((v: any) => ({
        id_clientes: Number(v.id_clientes),
        data_hora_atendimento: v.data_hora_atendimento,
      })),
    })

    return NextResponse.json({ sucesso: true, id_agenda })
  } catch (err: any) {
    // Validation errors (duplicate agenda) → 409 Conflict with friendly message.
    // Don't log expected business-rule errors to the console (avoids noise in the user's terminal).
    if (err.code === 'DUPLICATE_AGENDA') {
      return NextResponse.json(
        { erro: err.message, code: 'DUPLICATE_AGENDA', existing_id: err.existingId },
        { status: 409 }
      )
    }
    console.error('[agenda/create] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao criar agenda: ' + err.message },
      { status: 500 }
    )
  }
}
