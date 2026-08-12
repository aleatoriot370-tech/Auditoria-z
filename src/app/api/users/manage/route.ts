import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listAllUsers, createUser } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/users/manage
 * Lists all users (optionally filtered by Tipo).
 * Only Admin Senior can access this endpoint.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (session.Tipo !== 'Admin Senior') {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas Admin Senior pode gerenciar usuários.' },
      { status: 403 }
    )
  }

  const url = new URL(req.url)
  const tiposParam = url.searchParams.get('tipos')
  const tipos = tiposParam ? tiposParam.split(',') : undefined

  try {
    const users = await listAllUsers(tipos)
    // Strip Senha from response for security
    const safeUsers = users.map((u) => {
      const { Senha, ...rest } = u
      return rest
    })
    return NextResponse.json({ users: safeUsers })
  } catch (err: any) {
    console.error('[users/manage GET] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao listar usuários: ' + err.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users/manage
 * Creates a new user.
 * Only Admin Senior can create users.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (session.Tipo !== 'Admin Senior') {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas Admin Senior pode criar usuários.' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { Login, Senha, Tipo, Nome, Status } = body ?? {}

    if (!Login || !Senha || !Tipo || !Nome || !Status) {
      return NextResponse.json(
        { erro: 'Todos os campos são obrigatórios (Login, Senha, Tipo, Nome, Status).' },
        { status: 400 }
      )
    }

    const allowedTipos = ['Users', 'Comercial', 'Admin Senior', 'Admin Junior']
    if (!allowedTipos.includes(Tipo)) {
      return NextResponse.json(
        { erro: `Tipo inválido. Valores permitidos: ${allowedTipos.join(', ')}` },
        { status: 400 }
      )
    }

    if (!['a', 'i'].includes(Status)) {
      return NextResponse.json(
        { erro: 'Status inválido. Use "a" (ativo) ou "i" (inativo).' },
        { status: 400 }
      )
    }

    const result = await createUser({ Login, Senha, Tipo, Nome, Status })
    return NextResponse.json({ sucesso: true, id_user: result.id_user })
  } catch (err: any) {
    if (err.code === 'DUPLICATE_LOGIN') {
      return NextResponse.json(
        { erro: err.message, code: 'DUPLICATE_LOGIN' },
        { status: 409 }
      )
    }
    console.error('[users/manage POST] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao criar usuário: ' + err.message },
      { status: 500 }
    )
  }
}
