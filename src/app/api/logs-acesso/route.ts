import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLogsAcesso } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/logs-acesso
 * Lists login history (log_acesso). Only Admin Senior can access this endpoint.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (session.Tipo !== 'Admin Senior') {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas Admin Senior pode ver o histórico de acessos.' },
      { status: 403 }
    )
  }

  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(Number(limitParam) || 200, 1000) : 200

  try {
    const logs = await getLogsAcesso(limit)
    return NextResponse.json({ logs })
  } catch (err: any) {
    console.error('[logs-acesso GET] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar acessos: ' + err.message },
      { status: 500 }
    )
  }
}
