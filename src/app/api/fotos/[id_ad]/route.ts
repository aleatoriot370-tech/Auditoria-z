import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFotosByVisitaId } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/fotos/[id_ad]
 * Returns all photos (fotos_vis) linked to a visita (ag_agenda_diaria.id_ad).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id_ad: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const { id_ad } = await params
  const id = Number(id_ad)
  if (Number.isNaN(id)) {
    return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })
  }

  try {
    const fotos = await getFotosByVisitaId(id)
    return NextResponse.json({ fotos })
  } catch (err: any) {
    console.error('[fotos/[id_ad]] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao buscar fotos: ' + err.message },
      { status: 500 }
    )
  }
}
