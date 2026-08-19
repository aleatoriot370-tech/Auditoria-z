'use client'

import { useState } from 'react'
import {
  ArrowLeftRight, CalendarDays, Loader2, AlertCircle,
  CheckCircle2, Search, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SessionPayload } from '@/lib/auth'

interface AlteracaoRotaProps {
  session: SessionPayload
}

type Mode = 'change' | 'swap'

interface AgendaInfo {
  id_agenda: number
  data_agenda: string | null
  vendedor?: { Nome: string | null } | null
  status_atual: string | null
  placa: string | null
}

export function AlteracaoRota({ session }: AlteracaoRotaProps) {
  const [mode, setMode] = useState<Mode>('change')

  // --- Change date mode ---
  const [changeId, setChangeId] = useState('')
  const [changeNovaData, setChangeNovaData] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeResult, setChangeResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // --- Swap mode ---
  const [swapId1, setSwapId1] = useState('')
  const [swapId2, setSwapId2] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapResult, setSwapResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // --- Lookup state ---
  const [lookupLoading, setLookupLoading] = useState(false)
  const [agenda1Info, setAgenda1Info] = useState<AgendaInfo | null>(null)
  const [agenda2Info, setAgenda2Info] = useState<AgendaInfo | null>(null)

  async function lookupAgenda(id: string): Promise<AgendaInfo | null> {
    if (!id) return null
    setLookupLoading(true)
    try {
      const r = await fetch(`/api/agenda/${id}`)
      if (!r.ok) {
        const d = await r.json()
        toast.error(d.erro || 'Agenda não encontrada')
        return null
      }
      const d = await r.json()
      return d.agenda as AgendaInfo
    } catch {
      toast.error('Erro ao buscar agenda')
      return null
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleChangeLookup() {
    setChangeResult(null)
    const info = await lookupAgenda(changeId)
    if (info) {
      toast.info(`Agenda #${info.id_agenda} — ${info.vendedor?.Nome ?? '—'} — ${(info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}`)
    }
  }

  async function handleSwapLookup() {
    setSwapResult(null)
    const [info1, info2] = await Promise.all([
      lookupAgenda(swapId1),
      lookupAgenda(swapId2),
    ])
    setAgenda1Info(info1)
    setAgenda2Info(info2)
  }

  async function handleChangeDate() {
    if (!changeId || !changeNovaData) {
      toast.error('Preencha o código da agenda e a nova data.')
      return
    }
    setChangeLoading(true)
    setChangeResult(null)
    try {
      const r = await fetch('/api/alteracao-rota', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_agenda: Number(changeId), nova_data: changeNovaData }),
      })
      const d = await r.json()
      if (!r.ok) {
        setChangeResult({ ok: false, msg: d.erro || 'Erro ao alterar data' })
        return
      }
      setChangeResult({ ok: true, msg: d.mensagem })
      toast.success(d.mensagem)
      setChangeId('')
      setChangeNovaData('')
    } catch (err: any) {
      setChangeResult({ ok: false, msg: err.message || 'Erro inesperado' })
    } finally {
      setChangeLoading(false)
    }
  }

  async function handleSwap() {
    if (!swapId1 || !swapId2) {
      toast.error('Preencha os códigos das duas agendas.')
      return
    }
    if (swapId1 === swapId2) {
      toast.error('As agendas devem ser diferentes.')
      return
    }
    setSwapLoading(true)
    setSwapResult(null)
    try {
      const r = await fetch('/api/alteracao-rota/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_agenda_1: Number(swapId1), id_agenda_2: Number(swapId2) }),
      })
      const d = await r.json()
      if (!r.ok) {
        setSwapResult({ ok: false, msg: d.erro || 'Erro ao trocar datas' })
        return
      }
      setSwapResult({ ok: true, msg: d.mensagem })
      toast.success(d.mensagem)
      setSwapId1('')
      setSwapId2('')
      setAgenda1Info(null)
      setAgenda2Info(null)
    } catch (err: any) {
      setSwapResult({ ok: false, msg: err.message || 'Erro inesperado' })
    } finally {
      setSwapLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Altere a data de uma agenda ou troque as datas entre duas agendas.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('change'); setChangeResult(null); setSwapResult(null) }}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            mode === 'change'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Alterar Data
        </button>
        <button
          onClick={() => { setMode('swap'); setChangeResult(null); setSwapResult(null) }}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            mode === 'swap'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Trocar Datas
        </button>
      </div>

      {/* Rules info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Regras</h4>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          {mode === 'change' ? (
            <>
              <li>A agenda não pode estar finalizada</li>
              <li>Todas as visitas devem ter status &quot;Pendente&quot;</li>
              <li>Não pode haver outra agenda para o mesmo vendedor na nova data</li>
              <li>A nova data não pode ser anterior a hoje</li>
            </>
          ) : (
            <>
              <li>Nenhuma das duas agendas pode estar finalizada</li>
              <li>Todas as visitas de ambas devem ter status &quot;Pendente&quot;</li>
              <li>As duas agendas devem pertencer ao mesmo vendedor</li>
            </>
          )}
        </ul>
      </div>

      {/* Change date mode */}
      {mode === 'change' && (
        <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Alterar Data de uma Agenda
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
                Código da Agenda
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={changeId}
                  onChange={(e) => setChangeId(e.target.value)}
                  placeholder="Ex: 42"
                  className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleChangeLookup}
                  disabled={lookupLoading || !changeId}
                  className="h-10 px-3 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition flex items-center gap-1 disabled:opacity-60"
                  title="Consultar agenda"
                >
                  {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
                Nova Data
              </label>
              <input
                type="date"
                value={changeNovaData}
                onChange={(e) => setChangeNovaData(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <button
                onClick={handleChangeDate}
                disabled={changeLoading || !changeId || !changeNovaData}
                className="w-full h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {changeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>

          {changeResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
              changeResult.ok
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}>
              {changeResult.ok
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{changeResult.msg}</span>
            </div>
          )}
        </div>
      )}

      {/* Swap mode */}
      {mode === 'swap' && (
        <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Trocar Datas entre Duas Agendas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
                Agenda 1
              </label>
              <input
                type="number"
                value={swapId1}
                onChange={(e) => { setSwapId1(e.target.value); setAgenda1Info(null) }}
                placeholder="Ex: 42"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {agenda1Info && (
                <div className="text-xs text-muted-foreground mt-1 p-2 rounded-md bg-muted/40">
                  <span className="font-medium text-foreground">#{agenda1Info.id_agenda}</span>
                  {' — '}
                  {agenda1Info.vendedor?.Nome ?? '—'}
                  {' — '}
                  {(agenda1Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                  {' — '}
                  <span className={agenda1Info.status_atual === 'Pendente' ? 'text-amber-600' : 'text-foreground'}>
                    {agenda1Info.status_atual}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">
                Agenda 2
              </label>
              <input
                type="number"
                value={swapId2}
                onChange={(e) => { setSwapId2(e.target.value); setAgenda2Info(null) }}
                placeholder="Ex: 57"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {agenda2Info && (
                <div className="text-xs text-muted-foreground mt-1 p-2 rounded-md bg-muted/40">
                  <span className="font-medium text-foreground">#{agenda2Info.id_agenda}</span>
                  {' — '}
                  {agenda2Info.vendedor?.Nome ?? '—'}
                  {' — '}
                  {(agenda2Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                  {' — '}
                  <span className={agenda2Info.status_atual === 'Pendente' ? 'text-amber-600' : 'text-foreground'}>
                    {agenda2Info.status_atual}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Visual swap preview */}
          {agenda1Info && agenda2Info && (
            <div className="flex items-center justify-center gap-4 py-3">
              <div className="text-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground">Agenda #{agenda1Info.id_agenda}</div>
                <div className="text-sm font-semibold text-foreground">
                  {(agenda1Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                </div>
                <ArrowRight className="w-4 h-4 mx-auto my-1 text-primary" />
                <div className="text-sm font-bold text-primary">
                  {(agenda2Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                </div>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
              <div className="text-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground">Agenda #{agenda2Info.id_agenda}</div>
                <div className="text-sm font-semibold text-foreground">
                  {(agenda2Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                </div>
                <ArrowRight className="w-4 h-4 mx-auto my-1 text-primary" />
                <div className="text-sm font-bold text-primary">
                  {(agenda1Info.data_agenda ?? '').slice(0, 10).split('-').reverse().join('/')}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSwapLookup}
              disabled={lookupLoading || !swapId1 || !swapId2}
              className="h-10 px-4 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition flex items-center gap-2 disabled:opacity-60"
            >
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Consultar
            </button>
            <button
              onClick={handleSwap}
              disabled={swapLoading || !swapId1 || !swapId2}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
            >
              {swapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              Confirmar Troca
            </button>
          </div>

          {swapResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
              swapResult.ok
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}>
              {swapResult.ok
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{swapResult.msg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
