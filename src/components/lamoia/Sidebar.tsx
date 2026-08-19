'use client'

import { LayoutDashboard, FileCheck2, CalendarPlus, ListChecks, LogOut, X, LineChart, Users, ArrowLeftRight } from 'lucide-react'
import Image from 'next/image'
import type { SessionPayload } from '@/lib/auth'

export type ModuleKey = 'dashboard' | 'auditoria' | 'cadastro' | 'lista' | 'acompanhamento' | 'usuarios' | 'alteracao-rota'

interface SidebarProps {
  current: ModuleKey
  onNavigate: (m: ModuleKey) => void
  session: SessionPayload | null
  onLogout: () => void
  isOpen: boolean
  onClose: () => void
}

/**
 * Access control matrix — determines which modules each user type can see.
 *
 * | Tipo          | Dashboard | Auditoria | Cadastro | Lista | Acompanhamento | Usuários |
 * |---------------|-----------|-----------|----------|-------|----------------|----------|
 * | Admin Senior  | ✅        | ✅        | ✅       | ✅    | ✅             | ✅       |
 * | Admin Junior  | ✅        | ✅        | ✅       | ✅    | ✅             | ❌       |
 * | Comercial     | ✅        | ✅ (R/O)  | ✅       | ✅    | ✅             | ❌       |
 */
function getAllowedModules(tipo: string | null | undefined): ModuleKey[] {
  if (tipo === 'Admin Senior') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'usuarios', 'alteracao-rota']
  }
  if (tipo === 'Admin Junior') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'alteracao-rota']
  }
  if (tipo === 'Comercial') {
    return ['dashboard', 'auditoria', 'cadastro', 'lista', 'acompanhamento', 'alteracao-rota']
  }
  // Fallback: only dashboard
  return ['dashboard']
}

export function Sidebar({ current, onNavigate, session, onLogout, isOpen, onClose }: SidebarProps) {
  const allItems: { key: ModuleKey; label: string; icon: any; description: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Indicadores gerais' },
    { key: 'auditoria', label: 'Auditoria', icon: FileCheck2, description: 'Auditar agendas' },
    { key: 'cadastro', label: 'Cadastro de Agenda', icon: CalendarPlus, description: 'Nova agenda' },
    { key: 'lista', label: 'Lista de Agendas', icon: ListChecks, description: 'Agendas cadastradas' },
    { key: 'acompanhamento', label: 'Acompanhamento', icon: LineChart, description: 'Vendedores' },
    { key: 'alteracao-rota', label: 'Alteração de Rota', icon: ArrowLeftRight, description: 'Alterar datas' },
    { key: 'usuarios', label: 'Usuários', icon: Users, description: 'Gestão de acessos' },
  ]

  const allowedModules = getAllowedModules(session?.Tipo)
  const items = allItems.filter((item) => allowedModules.includes(item.key))

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
          <div className="relative w-32 h-8">
            <Image
              src="/logo-lamoia.png"
              alt="Grupo Lamoia"
              fill
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((it) => {
            const Icon = it.icon
            const active = current === it.key
            return (
              <button
                key={it.key}
                onClick={() => {
                  onNavigate(it.key)
                  onClose()
                }}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-start gap-3 transition group ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-sidebar-accent' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.label}</div>
                  <div className={`text-xs truncate ${active ? 'text-sidebar-accent-foreground/70' : 'text-sidebar-foreground/50'}`}>
                    {it.description}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-4 py-3 rounded-lg bg-sidebar-accent/20 mb-2">
            <div className="text-xs text-sidebar-foreground/60 mb-0.5">Logado como</div>
            <div className="text-sm font-semibold text-sidebar-foreground truncate">
              {session?.Nome ?? '—'}
            </div>
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {session?.Tipo ?? '—'}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-sidebar-foreground transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
