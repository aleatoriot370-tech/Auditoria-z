// Run with: bun run scripts/seed.ts  (or: node scripts/seed.js for cross-platform)
// Seeds the local SQLite with sample data for sandbox preview.
// In production, the user runs `supabase.sql` against their Supabase instance.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding local SQLite database...')

  // --- Users ---
  // Tipo conceitos:
  //   - 'Admin Senior' / 'Admin Junior' = Administrativo (gestão do sistema)
  //   - 'Comercial'                    = Gestor (lidera vendedores)
  //   - 'Users'                        = Vendedor (executa as rotas)
  const pwdHash = await bcrypt.hash('admin123', 10)
  const adminSr = await db.users.upsert({
    where: { Login: 'admin' },
    update: {},
    create: {
      Login: 'admin',
      Senha: pwdHash,
      Tipo: 'Admin Senior',
      Nome: 'Administrador Geral',
      Status: 'a',
    },
  })

  const adminJr = await db.users.upsert({
    where: { Login: 'junior' },
    update: {},
    create: {
      Login: 'junior',
      Senha: pwdHash,
      Tipo: 'Admin Junior',
      Nome: 'João Junior',
      Status: 'a',
    },
  })

  // Gestores (Tipo = 'Comercial')
  const gestor1 = await db.users.upsert({
    where: { Login: 'comercial1' },
    update: {},
    create: {
      Login: 'comercial1',
      Senha: pwdHash,
      Tipo: 'Comercial',
      Nome: 'Carlos Santos',
      Status: 'a',
    },
  })

  const gestor2 = await db.users.upsert({
    where: { Login: 'comercial2' },
    update: {},
    create: {
      Login: 'comercial2',
      Senha: pwdHash,
      Tipo: 'Comercial',
      Nome: 'Mariana Costa',
      Status: 'a',
    },
  })

  const gestor3 = await db.users.upsert({
    where: { Login: 'comercial3' },
    update: {},
    create: {
      Login: 'comercial3',
      Senha: pwdHash,
      Tipo: 'Comercial',
      Nome: 'Pedro Almeida',
      Status: 'a',
    },
  })

  // Vendedores (Tipo = 'Users')
  const vendedor1 = await db.users.upsert({
    where: { Login: 'vendedor1' },
    update: {},
    create: {
      Login: 'vendedor1',
      Senha: pwdHash,
      Tipo: 'Users',
      Nome: 'Roberto Silva',
      Status: 'a',
    },
  })

  const vendedor2 = await db.users.upsert({
    where: { Login: 'vendedor2' },
    update: {},
    create: {
      Login: 'vendedor2',
      Senha: pwdHash,
      Tipo: 'Users',
      Nome: 'Ana Paula Oliveira',
      Status: 'a',
    },
  })

  const vendedor3 = await db.users.upsert({
    where: { Login: 'vendedor3' },
    update: {},
    create: {
      Login: 'vendedor3',
      Senha: pwdHash,
      Tipo: 'Users',
      Nome: 'Fernando Souza',
      Status: 'a',
    },
  })

  // inactive user (Tipo = 'Users' but Status = 'i')
  await db.users.upsert({
    where: { Login: 'inativo' },
    update: {},
    create: {
      Login: 'inativo',
      Senha: pwdHash,
      Tipo: 'Users',
      Nome: 'Usuario Inativo',
      Status: 'i',
    },
  })

  // unauthorized tipo
  await db.users.upsert({
    where: { Login: 'qualidade' },
    update: {},
    create: {
      Login: 'qualidade',
      Senha: pwdHash,
      Tipo: 'Qualidade',
      Nome: 'Ana Qualidade',
      Status: 'a',
    },
  })

  // --- Clientes ---
  const clientes = [
    { Codigo: 1001, Razao: 'Supermercado Central Ltda', CNPJ_CPF: BigInt(12345678000199), Endereco: 'Av Brasil 1000', Bairro: 'Centro', Cidade: 'São Paulo', UF: 'SP' },
    { Codigo: 1002, Razao: 'Farmácia Saúde Total', CNPJ_CPF: BigInt(12345678000277), Endereco: 'Rua das Flores 250', Bairro: 'Jardim Primavera', Cidade: 'Campinas', UF: 'SP' },
    { Codigo: 1003, Razao: 'Distribuidora Norte S/A', CNPJ_CPF: BigInt(12345678000355), Endereco: 'Rod Anhanguera km 30', Bairro: 'Distrito Industrial', Cidade: 'Jundiaí', UF: 'SP' },
    { Codigo: 1004, Razao: 'Padaria Pão Quente', CNPJ_CPF: BigInt(12345678000433), Endereco: 'Rua XV de Novembro 78', Bairro: 'Centro', Cidade: 'São Paulo', UF: 'SP' },
    { Codigo: 1005, Razao: 'Mercearia do João', CNPJ_CPF: BigInt(12345678000511), Endereco: 'Av Paulista 1500', Bairro: 'Bela Vista', Cidade: 'São Paulo', UF: 'SP' },
    { Codigo: 1006, Razao: 'Açougue Boi Feliz', CNPJ_CPF: BigInt(12345678000690), Endereco: 'Rua dos Andradas 200', Bairro: 'Santana', Cidade: 'São Paulo', UF: 'SP' },
    { Codigo: 1007, Razao: 'Hortifruti Natureba', CNPJ_CPF: BigInt(12345678000778), Endereco: 'Rua Vergueiro 5000', Bairro: 'Vila Mariana', Cidade: 'São Paulo', UF: 'SP' },
    { Codigo: 1008, Razao: 'Quitanda do Zé', CNPJ_CPF: BigInt(12345678000856), Endereco: 'Rua Teixeira 90', Bairro: 'Pinheiros', Cidade: 'São Paulo', UF: 'SP' },
  ]
  for (const c of clientes) {
    await db.clientes.upsert({
      where: { Codigo: c.Codigo },
      update: {},
      create: c,
    })
  }

  // --- Agendas ---
  const today = new Date()
  const mes_ref = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  const vendedores = [vendedor1, vendedor2, vendedor3]
  const gestores = [gestor1, gestor2, gestor3]

  // Pending agendas for PAST dates (auditable — for testing the auditoria flow)
  for (let i = 1; i <= 3; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const vendedor = vendedores[(i - 1) % 3]
    const gestor = gestores[(i - 1) % 3]
    const ag = await db.ag_agenda.create({
      data: {
        id_gerente: gestor.id_user,
        id_vendedor: vendedor.id_user,
        status_atual: 'Pendente',
        data_agenda: date,
        mes_referencia: mes_ref(date),
        placa: `PAS${1000 + i}`,
        data_criacao: new Date(date.getTime() - 86400000),
      },
    })
    const numVisits = 3 + (i % 3)
    for (let j = 0; j < numVisits; j++) {
      const cliente = clientes[(i + j) % clientes.length]
      const visitDate = new Date(date)
      visitDate.setHours(8 + j * 2, 0, 0, 0)
      await db.ag_agenda_diaria.create({
        data: {
          id_a: ag.id_agenda,
          id_clientes: cliente.Codigo,
          status_atendimento: 'Pendente',
          data_hora_atendimento_inicio: visitDate,
          data_hora_atendimento_fim: new Date(visitDate.getTime() + 30 * 60 * 1000),
          latitude: '-23.5505',
          longitude: '-46.6333',
        },
      })
    }
  }

  // Pending agendas for TODAY and FUTURE dates (NOT auditable — visit hasn't happened yet)
  for (let i = 0; i < 5; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const vendedor = vendedores[i % 3]
    const gestor = gestores[i % 3]
    const ag = await db.ag_agenda.create({
      data: {
        id_gerente: gestor.id_user,
        id_vendedor: vendedor.id_user,
        status_atual: 'Pendente',
        data_agenda: date,
        mes_referencia: mes_ref(date),
        placa: `FUT${1000 + i}`,
        data_criacao: new Date(),
      },
    })
    const numVisits = 3 + (i % 3)
    for (let j = 0; j < numVisits; j++) {
      const cliente = clientes[(i + j) % clientes.length]
      const visitDate = new Date(date)
      visitDate.setHours(8 + j * 2, 0, 0, 0)
      await db.ag_agenda_diaria.create({
        data: {
          id_a: ag.id_agenda,
          id_clientes: cliente.Codigo,
          status_atendimento: 'Pendente',
          data_hora_atendimento_inicio: visitDate,
          data_hora_atendimento_fim: new Date(visitDate.getTime() + 30 * 60 * 1000),
          latitude: '-23.5505',
          longitude: '-46.6333',
        },
      })
    }
  }

  // Finalized agendas for past dates
  // Helper: "HH:MM" → Date (epoch date + time, UTC)
  const timeToDate = (time: string): Date => {
    const [h, m] = time.split(':').map(Number)
    return new Date(Date.UTC(1970, 0, 1, h || 0, m || 0, 0, 0))
  }

  for (let i = 1; i <= 8; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const vendedor = vendedores[i % 3]
    const gestor = gestores[i % 3]
    const realizadas = 2 + (i % 3)
    const canceladas = i % 2
    const total = realizadas + canceladas + (i % 2)
    const eficiencia = total > 0 ? (realizadas / total) * 100 : 0
    const ag = await db.ag_agenda.create({
      data: {
        id_gerente: gestor.id_user,
        id_vendedor: vendedor.id_user,
        status_atual: 'Finalizado',
        data_agenda: date,
        mes_referencia: mes_ref(date),
        placa: `XYZ${2000 + i}`,
        data_criacao: new Date(date.getTime() - 86400000),
        // ⚠️ hora_inicial / hora_fim are now timestamp columns (Date, not string)
        hora_inicial: timeToDate('08:00'),
        hora_fim: timeToDate('17:00'),
        total_hora: '08:00',
        almoco: 'S',
        eficiencia,
        id_auditor: adminJr.id_user,
        data_aud: new Date(date.getTime() + 86400000),
        obs_geral: i % 3 === 0 ? 'Rota concluída sem observações.' : null,
      },
    })
    for (let j = 0; j < total; j++) {
      const cliente = clientes[(i + j) % clientes.length]
      const status = j < realizadas ? 'Realizado' : j < realizadas + canceladas ? 'Cancelado' : 'Pendente'
      const visitDate = new Date(date)
      visitDate.setHours(8 + j * 2, 0, 0, 0)
      await db.ag_agenda_diaria.create({
        data: {
          id_a: ag.id_agenda,
          id_clientes: cliente.Codigo,
          status_atendimento: status,
          data_hora_atendimento_inicio: visitDate,
          data_hora_atendimento_fim: new Date(visitDate.getTime() + 30 * 60 * 1000),
          latitude: '-23.5505',
          longitude: '-46.6333',
          observacao: status === 'Cancelado' ? 'Cliente indisponível' : null,
        },
      })
    }
  }

  // --- Sample photos (fotos_vis) — for the first visita of the first finalized agenda ---
  try {
    const firstAgenda = await db.ag_agenda.findFirst({
      where: { status_atual: 'Finalizado' },
      orderBy: { id_agenda: 'asc' },
    })
    if (firstAgenda) {
      const firstVisita = await db.ag_agenda_diaria.findFirst({
        where: { id_a: firstAgenda.id_agenda },
        orderBy: { id_ad: 'asc' },
      })
      if (firstVisita) {
        const sampleFotos = [
          { id_vis: firstVisita.id_ad, Nome_Foto: 'sample_fachada.jpg', Tipo: 'Fachada', Loc_Foto: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800' },
          { id_vis: firstVisita.id_ad, Nome_Foto: 'sample_antes.jpg', Tipo: 'Antes', Loc_Foto: 'https://images.unsplash.com/photo-1581558438927-9b39bb95eb4d?w=800' },
          { id_vis: firstVisita.id_ad, Nome_Foto: 'sample_depois.jpg', Tipo: 'Depois', Loc_Foto: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800' },
        ]
        for (const f of sampleFotos) {
          await db.fotos_vis.upsert({
            where: { Nome_Foto: f.Nome_Foto },
            update: {},
            create: f,
          })
        }
        console.log('Sample photos inserted for visita', firstVisita.id_ad)
      }
    }
  } catch (e: any) {
    console.log('Skip sample photos:', e.message)
  }

  console.log('Seed completed successfully!')
  console.log('---')
  console.log('Tipo conceitos:')
  console.log('  Admin Senior / Admin Junior = Administrativo')
  console.log('  Comercial                   = Gestor')
  console.log('  Users                       = Vendedor')
  console.log('---')
  console.log('Logins de demonstração:')
  console.log('  admin / admin123     (Admin Senior)')
  console.log('  junior / admin123    (Admin Junior)')
  console.log('  comercial1 / admin123 (Comercial = Gestor)')
  console.log('  vendedor1 / admin123  (Users = Vendedor)')
  console.log('  qualidade / admin123  (unauthorized tipo - should fail)')
  console.log('  inativo / admin123    (inactive - should fail)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
