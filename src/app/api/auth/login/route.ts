import { NextRequest, NextResponse } from 'next/server'
import { validateLogin, isSupabaseEnabled } from '@/lib/datasource'
import { setSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30  // Netlify functions can take up to 30s

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { sucesso: false, mensagem: 'Corpo da requisição inválido.' },
        { status: 400 }
      )
    }
    const { login, senha } = body
    if (!login || !senha) {
      return NextResponse.json(
        { sucesso: false, mensagem: 'Login e senha são obrigatórios.' },
        { status: 400 }
      )
    }

    // Diagnostic: confirm Supabase is configured
    if (!isSupabaseEnabled()) {
      console.error('[login] Supabase env vars not configured')
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            'Erro de configuração: as variáveis de ambiente do Supabase não estão definidas. ' +
            'Verifique NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no Netlify.',
        },
        { status: 500 }
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
    console.error('[login] error:', err?.message || err)

    // Return a more helpful error message that hints at the cause
    let mensagem = 'Erro interno no servidor.'
    if (err?.message?.includes('fetch')) {
      mensagem =
        'Não foi possível conectar ao Supabase. Verifique se NEXT_PUBLIC_SUPABASE_URL está correto.'
    } else if (err?.message?.includes('JWT') || err?.message?.includes('key')) {
      mensagem =
        'Erro de autenticação com o Supabase. Verifique NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.'
    } else if (err?.message?.includes('bcrypt') || err?.message?.includes('crypt')) {
      mensagem = 'Erro ao validar senha. Tente novamente.'
    }

    return NextResponse.json(
      { sucesso: false, mensagem },
      { status: 500 }
    )
  }
}
