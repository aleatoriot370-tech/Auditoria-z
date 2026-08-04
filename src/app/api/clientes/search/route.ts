import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findClienteByCodigo, findClientesByCodigos } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const codigo = url.searchParams.get('codigo')

  if (!codigo) {
    return NextResponse.json({ erro: 'codigo é obrigatório.' }, { status: 400 })
  }

  try {
    const cliente = await findClienteByCodigo(Number(codigo))
    if (!cliente) {
      return NextResponse.json(
        { encontrado: false, mensagem: `Cliente com código ${codigo} não localizado.` },
        { status: 404 }
      )
    }
    return NextResponse.json({ encontrado: true, cliente })
  } catch (err: any) {
    console.error('[clientes/search] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao buscar cliente: ' + err.message },
      { status: 500 }
    )
  }
}
