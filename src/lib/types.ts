// Shared domain types used across the app (Prisma + Supabase share these shapes).

export type UserTipo = 'Admin Senior' | 'Admin Junior' | 'Comercial' | 'Qualidade' | 'User'
export type UserStatus = 'a' | 'i'

export interface User {
  id_user: number
  Login: string | null
  Senha: string | null
  Tipo: UserTipo | string | null
  Nome: string | null
  Status: UserStatus | string | null
  created_at?: string | null
}

export interface Cliente {
  id: number
  Codigo: number
  Razao: string | null
  CNPJ_CPF: number | string | null
  Endereco: string | null
  Bairro: string | null
  Cidade: string | null
  UF: string | null
}

export interface Agenda {
  id_agenda: number
  data_criacao: string
  id_gerente: number | null
  id_vendedor: number | null
  status_atual: string | null
  data_agenda: string | null
  mes_referencia: string | null
  placa: string | null
  hora_inicial: string | null
  hora_fim: string | null
  total_hora: string | null
  eficiencia: number | null
  id_auditor: number | null
  data_aud: string | null
  almoco: string | null
  obs_geral: string | null
}

export interface AgendaDiaria {
  id_ad: number
  id_a: number | null
  id_clientes: number | null
  status_atendimento: string | null
  data_hora_atendimento: string | null
  observacao: string | null
  latitude: string | null
  longitude: string | null
  // joined fields (optional - returned by some queries)
  cliente?: Cliente | null
}

export interface AgendaWithJoins extends Agenda {
  gerente?: { id_user: number; Nome: string | null } | null
  vendedor?: { id_user: number; Nome: string | null } | null
  auditor?: { id_user: number; Nome: string | null } | null
  visitas?: AgendaDiaria[]
  total_visitas?: number
  visitas_realizadas?: number
  visitas_canceladas?: number
  visitas_pendentes?: number
  visitas_pendentes_aud?: number
}

export interface DashboardFilters {
  mes_referencia?: string
  data_inicio?: string
  data_fim?: string
  id_gerente?: number
  id_vendedor?: number
}

export interface DashboardStats {
  total_agendas: number
  auditorias_realizadas: number
  visitas_agendadas: number
  visitas_realizadas: number
}

export interface DailyPoint {
  data: string
  agendas: number
  auditorias: number
}

export interface StatusCount {
  status: string
  total: number
}

export interface AuditoriaRow {
  id_agenda: number
  gerente: string
  vendedor: string
  visitas_agendadas: number
  visitas_realizadas: number
  visitas_canceladas: number
  total_hora: string | null
  eficiencia: number | null
  data_aud: string | null
}
