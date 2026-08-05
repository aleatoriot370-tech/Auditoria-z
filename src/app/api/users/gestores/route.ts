import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listActiveUsersByTipos } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lista GESTORES (Tipo = 'Comercial').
 * Usado no dropdown "Gestor" da tela de Cadastro de Agenda quando o usuário
 * logado é Administrativo (Admin Senior / Admin Junior).
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const users = await listActiveUsersByTipos(['Comercial'])
    return NextResponse.json({
      gestores: users.map((u) => ({ id_user: u.id_user, Nome: u.Nome })),
    })
  } catch (err: any) {
    console.error('[users/gestores] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar gestores: ' + err.message },
      { status: 500 }
    )
  }
}
