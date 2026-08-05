'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, User as UserIcon, AlertCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!login || !senha) {
      setErro('Preencha login e senha.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        setErro(data.mensagem || 'Falha ao autenticar.')
        return
      }
      toast.success(`Bem-vindo, ${data.usuario?.Nome ?? login}!`)
      onLoggedIn()
    } catch (err) {
      console.error(err)
      setErro('Erro de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-stretch bg-muted/40">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-1/2 brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#AEF544] blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white blur-3xl opacity-10" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-12">
              <Image
                src="/logo-lamoia.png"
                alt="Grupo Lamoia"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">
              Auditoria de Rota de Vendas
            </h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Acompanhe a execução das agendas de visita, audite o cumprimento das
              rotas e mensure a eficiência da equipe comercial em tempo real.
            </p>
            <div className="flex items-center gap-3 text-sm text-[#AEF544]">
              <ShieldCheck className="w-5 h-5" />
              <span>Plataforma segura • Acesso restrito</span>
            </div>
          </div>

          <div className="text-xs text-white/50">
            © {new Date().getFullYear()} Grupo Lamoia. Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="md:hidden flex justify-center">
            <div className="relative w-40 h-12">
              <Image
                src="/logo-lamoia.png"
                alt="Grupo Lamoia"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">Acessar o sistema</h2>
            <p className="text-muted-foreground">
              Informe suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="login" className="text-sm font-medium text-foreground">
                Login
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="seu.login"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="senha" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
                />
              </div>
            </div>

            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
