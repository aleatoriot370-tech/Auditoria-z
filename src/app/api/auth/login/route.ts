import { NextRequest, NextResponse } from 'next/server'
import { validateLogin } from '@/lib/datasource'
import { setSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { login, senha } = await req.json()
    if (!login || !senha) {
      return NextResponse.json(
        { sucesso: false, mensagem: 'Login e senha são obrigatórios.' },
        { status: 400 }
      )
    }

    const result = await validateLogin(String(login).trim(), String(senha))

    if (!result.sucesso || !result.usuario) {
      return NextResponse.json(result, { status: 401 })
    }

    await setSession({
      id_user: result.usuario.id_user,
      Nome: result.usuario.Nome,
      Login: result.usuario.Login,
      Tipo: result.usuario.Tipo,
      Status: result.usuario.Status,
    })

    return NextResponse.json({ sucesso: true, usuario: result.usuario })
  } catch (err: any) {
    console.error('[login] error:', err)
    return NextResponse.json(
      { sucesso: false, mensagem: 'Erro interno no servidor.' },
      { status: 500 }
    )
  }
}
