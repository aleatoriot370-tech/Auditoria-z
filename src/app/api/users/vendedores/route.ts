import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listActiveUsersByTipos } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lista VENDEDORES (Tipo = 'Users').
 * Usado no dropdown "Vendedor" da tela de Cadastro de Agenda.
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const users = await listActiveUsersByTipos(['Users'])
    return NextResponse.json({
      vendedores: users.map((u) => ({ id_user: u.id_user, Nome: u.Nome })),
    })
  } catch (err: any) {
    console.error('[users/vendedores] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar vendedores: ' + err.message },
      { status: 500 }
    )
  }
}
