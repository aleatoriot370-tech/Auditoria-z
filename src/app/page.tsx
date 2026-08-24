'use client'

import { useState, useEffect, useCallback } from 'react'
import { LoginScreen } from '@/components/lamoia/LoginScreen'
import { Sidebar, type ModuleKey } from '@/components/lamoia/Sidebar'
import { TopBar } from '@/components/lamoia/TopBar'
import { Dashboard } from '@/components/lamoia/Dashboard'
import { Auditoria } from '@/components/lamoia/Auditoria'
import { CadastroAgenda } from '@/components/lamoia/CadastroAgenda'
import { ListaAgendas } from '@/components/lamoia/ListaAgendas'
import { AcompanhamentoVendedores } from '@/components/lamoia/AcompanhamentoVendedores'
import { Usuarios } from '@/components/lamoia/Usuarios'
import { AlteracaoRota } from '@/components/lamoia/AlteracaoRota'
import { LogAcesso } from '@/components/lamoia/LogAcesso'
import type { SessionPayload } from '@/lib/auth'

const TITLES: Record<ModuleKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard das Auditorias', subtitle: 'Indicadores de desempenho geral' },
  auditoria: { title: 'Auditoria', subtitle: 'Audite as agendas de visita' },
  cadastro: { title: 'Cadastro de Agenda', subtitle: 'Nova agenda manual ou via Excel' },
  lista: { title: 'Lista de Agendas', subtitle: 'Consulte e gerencie as agendas' },
  acompanhamento: { title: 'Acompanhamento de Vendedores', subtitle: 'Carteira, desempenho e produtividade' },
  'alteracao-rota': { title: 'Alteração de Rota', subtitle: 'Altere ou troque datas de agendas' },
  usuarios: { title: 'Usuários', subtitle: 'Gestão de cadastro e acessos' },
  'log-acesso': { title: 'Log de Acessos', subtitle: 'Histórico de logins no sistema' },
}

/**
 * Access control: returns the list of modules a user type can access.
 * Mirrors the same matrix used in the Sidebar component.
 */
function getAllowedModules(tipo: string | null | undefined): ModuleKey[] {
  if (tipo === 'Admin Senior') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'usuarios', 'alteracao-rota', 'log-acesso']
  }
  if (tipo === 'Admin Junior') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'alteracao-rota']
  }
  if (tipo === 'Comercial') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'alteracao-rota']
  }
  return ['dashboard']
}

export default function Home() {
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState<ModuleKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const checkSession = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/session')
      if (r.ok) {
        const d = await r.json()
        if (d.autenticado) {
          setSession(d.usuario as SessionPayload)
        } else {
          setSession(null)
        }
      }
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  async function handleLogout() {
    if (!confirm('Deseja realmente sair?')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    setSession(null)
    setModule('dashboard')
  }

  /**
   * Guard: if the current module is not allowed for the user's type,
   * redirect to dashboard.
   */
  useEffect(() => {
    if (session) {
      const allowed = getAllowedModules(session.Tipo)
      if (!allowed.includes(module)) {
        setModule('dashboard')
      }
    }
  }, [session, module])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onLoggedIn={checkSession} />
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar
        current={module}
        onNavigate={setModule}
        session={session}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={TITLES[module].title}
          subtitle={TITLES[module].subtitle}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1">
          {module === 'dashboard' && (
            <Dashboard
              isComercial={session.Tipo === 'Comercial'}
              userName={session.Nome}
            />
          )}
          {module === 'auditoria' && (
            <Auditoria readOnly={session.Tipo === 'Comercial'} />
          )}
          {module === 'cadastro' && <CadastroAgenda />}
          {module === 'lista' && <ListaAgendas />}
          {module === 'acompanhamento' && (
            <AcompanhamentoVendedores
              isComercial={session.Tipo === 'Comercial'}
              userId={session.id_user}
            />
          )}
          {module === 'alteracao-rota' && (
            <AlteracaoRota session={session} />
          )}
          {module === 'usuarios' && <Usuarios />}
          {module === 'log-acesso' && <LogAcesso />}
        </main>
      </div>
    </div>
  )
}
