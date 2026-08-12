import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, deleteUser } from '@/lib/datasource'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/manage/[id]
 * Updates an existing user.
 * Only Admin Senior can update users.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (session.Tipo !== 'Admin Senior') {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas Admin Senior pode editar usuários.' },
      { status: 403 }
    )
  }

  const { id } = await params
  const id_user = Number(id)
  if (Number.isNaN(id_user)) {
    return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { Login, Senha, Tipo, Nome, Status } = body ?? {}

    // Validate Tipo if provided
    if (Tipo !== undefined) {
      const allowedTipos = ['Users', 'Comercial', 'Admin Senior', 'Admin Junior']
      if (!allowedTipos.includes(Tipo)) {
        return NextResponse.json(
          { erro: `Tipo inválido. Valores permitidos: ${allowedTipos.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate Status if provided
    if (Status !== undefined && !['a', 'i'].includes(Status)) {
      return NextResponse.json(
        { erro: 'Status inválido. Use "a" (ativo) ou "i" (inativo).' },
        { status: 400 }
      )
    }

    await updateUser(id_user, {
      Login: Login !== undefined ? String(Login) : undefined,
      Senha: Senha || null,  // null/empty = keep existing password
      Tipo: Tipo !== undefined ? String(Tipo) : undefined,
      Nome: Nome !== undefined ? String(Nome) : undefined,
      Status: Status !== undefined ? String(Status) : undefined,
    })

    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    if (err.code === 'DUPLICATE_LOGIN') {
      return NextResponse.json(
        { erro: err.message, code: 'DUPLICATE_LOGIN' },
        { status: 409 }
      )
    }
    console.error('[users/manage PATCH] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao atualizar usuário: ' + err.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/manage/[id]
 * Deletes a user.
 * Only Admin Senior can delete users.
 * Cannot delete self.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (session.Tipo !== 'Admin Senior') {
    return NextResponse.json(
      { erro: 'Sem permissão. Apenas Admin Senior pode excluir usuários.' },
      { status: 403 }
    )
  }

  const { id } = await params
  const id_user = Number(id)
  if (Number.isNaN(id_user)) {
    return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })
  }

  // Prevent self-deletion
  if (id_user === session.id_user) {
    return NextResponse.json(
      { erro: 'Você não pode excluir sua própria conta.' },
      { status: 400 }
    )
  }

  try {
    await deleteUser(id_user)
    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    console.error('[users/manage DELETE] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao excluir usuário: ' + err.message },
      { status: 500 }
    )
  }
}
