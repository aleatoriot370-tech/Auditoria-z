'use client'

import { useState, useEffect } from 'react'
import {
  Save, X, Loader2, Plus, Trash2, FileUp, FileSpreadsheet, User, Calendar, Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface Vendedor { id_user: number; Nome: string | null }
interface Gestor { id_user: number; Nome: string | null }

interface ClienteRow {
  id_clientes: number | null
  Razao: string | null
  Bairro: string | null
  Cidade: string | null
  UF: string | null
}

interface SessionInfo {
  Tipo: string | null
  Nome: string | null
  id_user: number
}

export function CadastroAgenda() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [gestores, setGestores] = useState<Gestor[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingV, setLoadingV] = useState(true)

  // Shared fields
  const [idGestor, setIdGestor] = useState('')
  const [gestorNomeReadonly, setGestorNomeReadonly] = useState('')
  const [idVendedor, setIdVendedor] = useState('')
  const [placa, setPlaca] = useState('')

  // Mode
  const [mode, setMode] = useState<'manual' | 'import' | null>(null)

  // Manual fields
  const [dataAgenda, setDataAgenda] = useState('')
  const [clienteRows, setClienteRows] = useState<ClienteRow[]>([
    { id_clientes: null, Razao: null, Bairro: null, Cidade: null, UF: null },
  ])
  // Per-row input value (the text the user is currently typing before pressing Enter)
  const [rowInputs, setRowInputs] = useState<Record<number, string>>({})
  const [lookingUp, setLookingUp] = useState<Record<number, boolean>>({})

  // Import fields
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ data_agenda: string; id_clientes: number }[]>([])
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Is the logged-in user an administrative type? (Admin Senior / Admin Junior)
  const isAdmin = session?.Tipo === 'Admin Senior' || session?.Tipo === 'Admin Junior'

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then((r) => r.json()),
      fetch('/api/users/vendedores').then((r) => r.json()),
      fetch('/api/users/gestores').then((r) => r.json()),
    ])
      .then(([sess, vend, gest]) => {
        if (sess.autenticado) {
          setSession(sess.usuario)
          // If Comercial (gestor), prefill gestor with their own id
          if (sess.usuario.Tipo === 'Comercial') {
            setIdGestor(String(sess.usuario.id_user))
            setGestorNomeReadonly(sess.usuario.Nome ?? '')
          }
        }
        setVendedores(vend.vendedores ?? [])
        setGestores(gest.gestores ?? [])
      })
      .catch(() => toast.error('Erro ao carregar dados iniciais'))
      .finally(() => setLoadingV(false))
  }, [])

  async function lookupCliente(codigo: string, rowIndex: number) {
    const cod = Number(codigo)
    if (!cod || Number.isNaN(cod)) {
      toast.error('Informe um código numérico válido.')
      return
    }
    setLookingUp((s) => ({ ...s, [rowIndex]: true }))
    try {
      const r = await fetch(`/api/clientes/search?codigo=${cod}`)
      const d = await r.json()
      if (r.ok && d.encontrado) {
        const c = d.cliente
        setClienteRows((prev) => {
          const next = [...prev]
          next[rowIndex] = {
            id_clientes: c.Codigo,
            Razao: c.Razao,
            Bairro: c.Bairro,
            Cidade: c.Cidade,
            UF: c.UF,
          }
          // Add a new empty row if this is the last one
          if (rowIndex === next.length - 1) {
            next.push({ id_clientes: null, Razao: null, Bairro: null, Cidade: null, UF: null })
          }
          return next
        })
        setRowInputs((s) => {
          const next = { ...s }
          delete next[rowIndex]
          return next
        })
        // Focus next row's input automatically
        setTimeout(() => {
          const nextInput = document.querySelector<HTMLInputElement>(
            `input[data-row="${rowIndex + 1}"]`
          )
          if (nextInput) nextInput.focus()
        }, 50)
      } else {
        toast.error(d.mensagem || `Código ${codigo} não localizado.`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar cliente')
    } finally {
      setLookingUp((s) => ({ ...s, [rowIndex]: false }))
    }
  }

  function removeRow(index: number) {
    if (clienteRows.length === 1) {
      setClienteRows([{ id_clientes: null, Razao: null, Bairro: null, Cidade: null, UF: null }])
      setRowInputs({})
      return
    }
    if (!confirm('Excluir este item da lista?')) return
    setClienteRows((prev) => prev.filter((_, i) => i !== index))
    setRowInputs((prev) => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k)
        if (idx < index) next[idx] = v
        else if (idx > index) next[idx - 1] = v
      })
      return next
    })
  }

  function selectMode(m: 'manual' | 'import') {
    // Validate shared fields before allowing mode selection
    if (!idGestor || !idVendedor || !placa) {
      toast.error('Preencha Gestor, Vendedor e Placa antes de escolher o tipo de cadastro.')
      return
    }
    setMode(m)
  }

  async function handleSaveManual() {
    if (!dataAgenda) {
      toast.error('Informe a data da agenda.')
      return
    }
    const visitas = clienteRows.filter((r) => r.id_clientes != null)
    if (visitas.length === 0) {
      toast.error('Inclua pelo menos um cliente na agenda.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/agenda/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_gerente: Number(idGestor),
          id_vendedor: Number(idVendedor),
          data_agenda: dataAgenda,
          placa,
          visitas: visitas.map((v) => ({ id_clientes: v.id_clientes })),
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        // For 409 Conflict (duplicate agenda) → use longer duration (8s) so the user can read it.
        // For other errors → default duration.
        const duration = r.status === 409 ? 8000 : 6000
        toast.error(d.erro || 'Falha ao salvar agenda', { duration })
        return
      }
      toast.success(`Agenda #${d.id_agenda} criada com ${visitas.length} visita(s).`)
      resetForm()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleFile(file: File) {
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        const parsed: { data_agenda: string; id_clientes: number }[] = []
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          const cell0 = String(row[0] ?? '').toLowerCase().trim()
          if (cell0 === 'data_agenda' || cell0 === 'data') continue
          let dateStr: string | null = null
          const rawDate = row[0]
          if (typeof rawDate === 'number') {
            const d = XLSX.SSF.parse_date_code(rawDate)
            if (d && d.y) dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
          } else if (typeof rawDate === 'string') {
            const s = rawDate.trim()
            const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
            if (br) dateStr = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
            else {
              const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
              if (iso) dateStr = s
            }
          } else if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().slice(0, 10)
          }
          if (!dateStr) continue
          const cod = Number(row[1])
          if (!Number.isFinite(cod) || cod <= 0) continue
          parsed.push({ data_agenda: dateStr, id_clientes: cod })
        }
        setImportPreview(parsed)
        if (parsed.length === 0) toast.warning('Nenhuma linha válida encontrada.')
        else toast.info(`${parsed.length} linhas lidas — clique em Importar para validar e salvar.`)
      } catch (err: any) {
        toast.error('Falha ao ler planilha: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (importPreview.length === 0) {
      toast.error('Nenhuma linha para importar.')
      return
    }
    setImporting(true)
    try {
      const formData = new FormData()
      if (!importFile) {
        toast.error('Selecione um arquivo.')
        setImporting(false)
        return
      }
      formData.append('file', importFile)
      formData.append('id_gerente', idGestor)
      formData.append('id_vendedor', idVendedor)
      formData.append('placa', placa)

      const r = await fetch('/api/agenda/import', { method: 'POST', body: formData })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.erro || 'Falha ao importar')
        return
      }
      // If some dates were skipped (already had agendas), show a warning toast
      // with longer duration; otherwise show a success toast.
      if (d.skipped_dates && d.skipped_dates.length > 0) {
        toast.warning(d.mensagem || `${d.total_agendas} agenda(s) importada(s). ${d.skipped_dates.length} data(s) não foram importadas pois já possuem agenda.`, { duration: 10000 })
      } else {
        toast.success(`Importação concluída! ${d.total_agendas} agenda(s) • ${d.total_visitas} visita(s).`)
      }
      resetForm()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar')
    } finally {
      setImporting(false)
    }
  }

  /**
   * Reset form state after a successful save/import.
   * Does NOT prompt the user — this is a clean reset, not a cancellation.
   */
  function resetForm() {
    setMode(null)
    setIdVendedor('')
    setPlaca('')
    setDataAgenda('')
    setClienteRows([{ id_clientes: null, Razao: null, Bairro: null, Cidade: null, UF: null }])
    setRowInputs({})
    setImportFile(null)
    setImportPreview([])
    // Keep idGestor (since Comercial is always their own; Admin can keep last selection)
  }

  /**
   * Cancel button handler — prompts the user before discarding unsaved changes.
   */
  function handleCancel() {
    if (mode === 'manual' && clienteRows.some((r) => r.id_clientes != null)) {
      if (!confirm('Cancelar? Todas as alterações não salvas serão perdidas.')) return
    }
    if (mode === 'import' && importPreview.length > 0) {
      if (!confirm('Cancelar? Todas as alterações não salvas serão perdidas.')) return
    }
    resetForm()
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Cadastre uma nova agenda manualmente ou importe uma planilha Excel.
        </p>
      </div>

      {/* Shared header */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Gestor field — dynamic based on user Tipo */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
              <User className="w-3 h-3" /> Gestor
            </label>
            {isAdmin ? (
              // Admin user → dropdown with all Comercial (gestores)
              <select
                value={idGestor}
                onChange={(e) => setIdGestor(e.target.value)}
                disabled={loadingV || mode !== null}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                <option value="">{loadingV ? 'Carregando...' : 'Selecione o gestor...'}</option>
                {gestores.map((g) => (
                  <option key={g.id_user} value={g.id_user}>
                    {g.Nome ?? `#${g.id_user}`}
                  </option>
                ))}
              </select>
            ) : (
              // Comercial user → readonly with their own name
              <input
                type="text"
                value={gestorNomeReadonly}
                disabled
                className="w-full h-10 px-3 rounded-lg border border-border bg-muted/40 text-sm"
              />
            )}
          </div>

          {/* Vendedor field — dropdown with all Users (vendedores) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide">Vendedor</label>
            <select
              value={idVendedor}
              onChange={(e) => setIdVendedor(e.target.value)}
              disabled={loadingV || mode !== null}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <option value="">{loadingV ? 'Carregando...' : 'Selecione o vendedor...'}</option>
              {vendedores.map((v) => (
                <option key={v.id_user} value={v.id_user}>
                  {v.Nome ?? `#${v.id_user}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
              <Truck className="w-3 h-3" /> Placa
            </label>
            <input
              type="text"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              disabled={mode !== null}
              placeholder="ABC1D23"
              maxLength={8}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>
        </div>

        {mode === null && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <button
              onClick={() => selectMode('manual')}
              className="flex-1 min-w-40 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition flex items-center justify-center gap-2 font-medium text-primary"
            >
              <Plus className="w-4 h-4" />
              Cadastro Manual
            </button>
            <button
              onClick={() => selectMode('import')}
              className="flex-1 min-w-40 h-12 rounded-lg border-2 border-[#AEF544]/60 bg-[#AEF544]/10 hover:bg-[#AEF544]/20 transition flex items-center justify-center gap-2 font-medium text-[#0f2070]"
            >
              <FileUp className="w-4 h-4" />
              Importar Excel
            </button>
          </div>
        )}
      </div>

      {/* Manual mode */}
      {mode === 'manual' && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
            <div className="space-y-2 max-w-xs">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data da Agenda
              </label>
              <input
                type="date"
                value={dataAgenda}
                onChange={(e) => setDataAgenda(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Clientes a visitar</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Digite o código do cliente e pressione Enter para adicioná-lo.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-3 font-medium w-32">Código</th>
                    <th className="px-3 py-3 font-medium">Razão</th>
                    <th className="px-3 py-3 font-medium">Bairro</th>
                    <th className="px-3 py-3 font-medium">Cidade</th>
                    <th className="px-3 py-3 font-medium w-16">UF</th>
                    <th className="px-3 py-3 font-medium w-16 text-center">Excluir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clienteRows.map((row, idx) => {
                    const hasCliente = row.id_clientes != null
                    const isLookingUp = lookingUp[idx]
                    return (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          {hasCliente ? (
                            <div className="h-9 px-2 flex items-center text-sm tabular-nums font-medium">
                              {row.id_clientes}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="number"
                                inputMode="numeric"
                                data-row={idx}
                                value={rowInputs[idx] ?? ''}
                                onChange={(e) =>
                                  setRowInputs((s) => ({ ...s, [idx]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    lookupCliente((e.target as HTMLInputElement).value, idx)
                                  }
                                }}
                                placeholder="código"
                                autoFocus={idx === 0}
                                disabled={isLookingUp}
                                className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                              />
                              {isLookingUp && (
                                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">{row.Razao ?? '—'}</td>
                        <td className="px-3 py-3">{row.Bairro ?? '—'}</td>
                        <td className="px-3 py-3">{row.Cidade ?? '—'}</td>
                        <td className="px-3 py-3 text-center">{row.UF ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {hasCliente && (
                            <button
                              onClick={() => removeRow(idx)}
                              className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSaveManual}
              disabled={saving}
              className="h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Agenda
            </button>
          </div>
        </>
      )}

      {/* Import mode */}
      {mode === 'import' && (
        <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#0f2070]" />
            <h3 className="text-base font-semibold text-foreground">Importar planilha Excel</h3>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Formato esperado:</p>
            <p>Coluna A: <code className="px-1 py-0.5 rounded bg-background">data_agenda</code> (DD/MM/AAAA ou AAAA-MM-DD)</p>
            <p>Coluna B: <code className="px-1 py-0.5 rounded bg-background">codigo_cliente</code> (número)</p>
            <p className="mt-2">Cada data única gera uma agenda. Várias linhas com a mesma data pertencem à mesma agenda.</p>
          </div>

          <div>
            <label className="block">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
                className="hidden"
              />
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-medium text-foreground">
                  {importFile ? importFile.name : 'Clique para selecionar o arquivo'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {importFile ? `${importPreview.length} linhas lidas` : 'Formatos: .xlsx, .xls, .csv'}
                </div>
              </div>
            </label>
          </div>

          {importPreview.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                Pré-visualização ({importPreview.length} linhas)
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-medium w-16">#</th>
                      <th className="px-3 py-2 font-medium">Data Agenda</th>
                      <th className="px-3 py-2 font-medium">Código Cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {importPreview.slice(0, 100).map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 tabular-nums">{p.data_agenda.split('-').reverse().join('/')}</td>
                        <td className="px-3 py-2 tabular-nums">{p.id_clientes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={handleCancel}
              disabled={importing}
              className="h-11 px-6 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing || importPreview.length === 0}
              className="h-11 px-6 rounded-lg bg-[#AEF544] text-[#0f2070] text-sm font-bold hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Importar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
