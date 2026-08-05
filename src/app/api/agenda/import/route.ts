import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findClientesByCodigos, createAgendaWithVisitas } from '@/lib/datasource'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ParsedRow {
  data_agenda: string
  id_clientes: number
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const id_vendedor = formData.get('id_vendedor') as string | null
    const id_gerente = formData.get('id_gerente') as string | null
    const placa = formData.get('placa') as string | null

    if (!file || !id_vendedor || !id_gerente || !placa) {
      return NextResponse.json(
        { erro: 'Arquivo, gestor, vendedor e placa são obrigatórios.' },
        { status: 400 }
      )
    }

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(Buffer.from(buf), { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Expect two columns: data_agenda, id_clientes. Skip header if it contains 'data'
    const parsed: ParsedRow[] = []
    const invalidDates: string[] = []
    const invalidCodes: number[] = []
    let rowIdx = 0
    for (const row of rows) {
      rowIdx++
      if (!row || row.length === 0) continue
      // detect header row
      const cell0 = String(row[0] ?? '').toLowerCase().trim()
      if (cell0 === 'data_agenda' || cell0 === 'data') continue

      const rawDate = row[0]
      const rawCode = row[1]

      // Try parse date
      let dateStr: string | null = null
      if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF ? XLSX.SSF.parse_date_code(rawDate) : null
        if (d && d.y) {
          dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
        }
      } else if (typeof rawDate === 'string') {
        // try DD/MM/YYYY or YYYY-MM-DD
        const s = rawDate.trim()
        const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (br) {
          dateStr = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
        } else {
          const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (iso) dateStr = s
        }
      } else if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10)
      }

      if (!dateStr) {
        invalidDates.push(`Linha ${rowIdx}: "${rawDate ?? ''}"`)
        continue
      }

      const codigo = Number(rawCode)
      if (!Number.isFinite(codigo) || codigo <= 0) {
        invalidCodes.push(`Linha ${rowIdx}`)
        continue
      }
      parsed.push({ data_agenda: dateStr, id_clientes: codigo })
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { erro: 'Nenhuma linha válida encontrada na planilha.' },
        { status: 400 }
      )
    }

    // Validate all client codes
    const allCodigos = Array.from(new Set(parsed.map((p) => p.id_clientes)))
    const found = await findClientesByCodigos(allCodigos)
    const foundSet = new Set(found.map((c) => c.Codigo))
    const missingCodes = allCodigos.filter((c) => !foundSet.has(c))

    if (missingCodes.length > 0) {
      return NextResponse.json(
        {
          erro: 'Importação cancelada. Códigos de cliente não localizados: ' + missingCodes.join(', '),
          invalid_dates: invalidDates,
          invalid_codes: invalidCodes,
          missing_codes: missingCodes,
        },
        { status: 400 }
      )
    }

    if (invalidDates.length > 0) {
      return NextResponse.json(
        {
          erro: 'Importação cancelada. Datas inválidas encontradas: ' + invalidDates.slice(0, 5).join('; ') + (invalidDates.length > 5 ? ` (+${invalidDates.length - 5} outras)` : ''),
          invalid_dates: invalidDates,
          invalid_codes: invalidCodes,
        },
        { status: 400 }
      )
    }

    // Group by date — one agenda per unique date
    const byDate = new Map<string, ParsedRow[]>()
    for (const p of parsed) {
      const list = byDate.get(p.data_agenda) ?? []
      list.push(p)
      byDate.set(p.data_agenda, list)
    }

    const createdIds: number[] = []
    for (const [data_agenda, items] of byDate.entries()) {
      const [y, m] = data_agenda.split('-')
      const mes_referencia = `${m}-${y}`
      const id = await createAgendaWithVisitas({
        id_gerente: Number(id_gerente),
        id_vendedor: Number(id_vendedor),
        data_agenda,
        placa,
        mes_referencia,
        visitas: items.map((p) => ({ id_clientes: p.id_clientes })),
      })
      createdIds.push(id)
    }

    return NextResponse.json({
      sucesso: true,
      total_agendas: createdIds.length,
      total_visitas: parsed.length,
      id_agendas: createdIds,
    })
  } catch (err: any) {
    console.error('[agenda/import] error:', err)
    return NextResponse.json(
      { erro: 'Falha ao importar planilha: ' + err.message },
      { status: 500 }
    )
  }
}
