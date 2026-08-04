import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveAuditoria } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      id_agenda,
      hora_inicial,
      hora_fim,
      almoco,
      obs_geral,
      visitas,
    } = body ?? {}

    if (!id_agenda || !hora_inicial || !hora_fim || !visitas || !Array.isArray(visitas)) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios ausentes.' },
        { status: 400 }
      )
    }

    // Validate that all visitas have status Realizado or Cancelado
    const invalidStatus = visitas.filter(
      (v: any) => v.status_atendimento !== 'Realizado' && v.status_atendimento !== 'Cancelado'
    )
    if (invalidStatus.length > 0) {
      return NextResponse.json(
        { erro: 'Todas as visitas devem ter status Realizado ou Cancelado antes de salvar a auditoria.' },
        { status: 400 }
      )
    }

    // Calculate total_hora = (fim - inicial) - 1h lunch (if almoco === 'S')
    const total_hora = computeTotalHora(hora_inicial, hora_fim, almoco === 'S')
    if (!total_hora) {
      return NextResponse.json(
        { erro: 'Horário inicial maior ou igual ao horário fim.' },
        { status: 400 }
      )
    }

    // Compute efficiency
    const total_visitas = visitas.length
    const realizadas = visitas.filter((v: any) => v.status_atendimento === 'Realizado').length
    const eficiencia = total_visitas > 0 ? Number(((realizadas / total_visitas) * 100).toFixed(2)) : 0

    await saveAuditoria({
      id_agenda: Number(id_agenda),
      hora_inicial,
      hora_fim,
      total_hora,
      almoco: almoco === 'S' ? 'S' : 'N',
      obs_geral: obs_geral || null,
      eficiencia,
      id_auditor: session.id_user,
      visitas: visitas.map((v: any) => ({
        id_ad: Number(v.id_ad),
        status_atendimento: v.status_atendimento,
        observacao: v.observacao ?? null,
      })),
    })

    return NextResponse.json({ sucesso: true, eficiencia, total_hora })
  } catch (err: any) {
    console.error('[auditoria/save] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao salvar auditoria: ' + err.message },
      { status: 500 }
    )
  }
}

function computeTotalHora(inicial: string, fim: string, comAlmoco: boolean): string | null {
  const [hi, mi] = inicial.split(':').map(Number)
  const [hf, mf] = fim.split(':').map(Number)
  if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return null
  const iniMin = hi * 60 + mi
  const fimMin = hf * 60 + mf
  if (fimMin <= iniMin) return null
  let diff = fimMin - iniMin
  if (comAlmoco) diff = Math.max(0, diff - 60)
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
