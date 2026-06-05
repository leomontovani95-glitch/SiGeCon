# SiGeCon — Sistema de Gestão de Conduta

Sistema web para registro, tramitação, análise e publicação de comunicações de conduta escolar no âmbito da EsFAP, EsFO e APM-ES (PMES).

---

## Requisitos

- **Node.js** 18 ou superior
- **npm** 9 ou superior
- Windows, Linux ou macOS

---

## Instalação

```bash
# 1. Clone ou extraia o projeto
cd sigecon

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
# Edite o arquivo .env (já incluído):
# DATABASE_URL="file:./dev.db"
# SESSION_SECRET="<chave secreta com no mínimo 32 caracteres>"

# 4. Execute as migrations do banco de dados
npx prisma migrate dev

# 5. Popule o banco com os dados iniciais
npm run seed

# 6. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse: **http://localhost:3000**

---

## Login inicial do Administrador

| Campo  | Valor                 |
|--------|-----------------------|
| E-mail | admin@sigecone.mil.br |
| Senha  | Admin@2026            |

> **Importante:** Troque a senha do administrador após o primeiro acesso.

---

## Scripts disponíveis

| Comando               | Descrição                                      |
|-----------------------|------------------------------------------------|
| `npm run dev`         | Inicia o servidor em modo desenvolvimento      |
| `npm run build`       | Gera o build de produção                       |
| `npm run start`       | Inicia o servidor em modo produção             |
| `npm run seed`        | Popula o banco com dados iniciais              |
| `npm run setup`       | Executa migrations + seed (setup completo)     |
| `npm run db:migrate`  | Executa as migrations do banco                 |
| `npm run db:generate` | Regenera o cliente Prisma                      |
| `npm run db:reset`    | Reseta o banco e reaplica seed (APAGA TUDO)    |

---

## Estrutura de pastas

```
sigecon/
├── prisma/
│   ├── schema.prisma         # Modelos do banco de dados
│   ├── seed.ts               # Dados iniciais obrigatórios
│   └── migrations/           # Histórico de migrations
├── src/
│   ├── app/
│   │   ├── (app)/            # Rotas autenticadas (com sidebar)
│   │   │   ├── dashboard/    # Painel de controle
│   │   │   ├── alunos/       # CRUD de alunos + histórico imprimível
│   │   │   ├── comunicacoes/ # Fluxo CPI e Referência Elogiosa
│   │   │   ├── caderno/      # Caderno Disciplinar
│   │   │   ├── relatorios/   # Relatórios e filtros
│   │   │   ├── usuarios/     # CRUD de usuários (Admin)
│   │   │   ├── cursos/       # CRUD de cursos
│   │   │   ├── pelotons/     # CRUD de pelotões
│   │   │   ├── manual/       # Manual do Aluno (artigos/incisos)
│   │   │   └── tipos/        # Tipos de comunicação (pontuações)
│   │   ├── login/            # Tela de login
│   │   └── logout/           # Rota de logout
│   ├── components/
│   │   ├── Sidebar.tsx       # Menu lateral
│   │   └── PrintLayout.tsx   # Layout para impressão/PDF
│   ├── lib/
│   │   ├── db.ts             # Cliente Prisma (singleton)
│   │   ├── session.ts        # Gestão de sessão JWT (Jose)
│   │   ├── dal.ts            # Data Access Layer / autorização
│   │   ├── score.ts          # Cálculo da nota e faixas de cor
│   │   ├── prazos.ts         # Cálculo de prazo (dias úteis)
│   │   ├── protocolo.ts      # Geração automática de protocolo
│   │   └── audit.ts          # Registro de auditoria
│   └── proxy.ts              # Proteção de rotas (Next.js 16)
├── public/
│   ├── manifest.json         # PWA manifest
│   └── sw.js                 # Service Worker
└── .env                      # Variáveis de ambiente (não versionar)
```

---

## Perfis de usuário

| Perfil               | Descrição                                              |
|----------------------|--------------------------------------------------------|
| Administrador        | Acesso total; gerencia usuários, cursos e configurações |
| Comandante da Escola | Profere decisões finais; publica Caderno Disciplinar   |
| Subcomandante        | Emite pareceres (concorrência com Oficial)             |
| Oficial da Escola    | Emite pareceres (concorrência com Subcomandante)       |
| Chefe de Curso       | Consulta e acompanha (sem emitir parecer ou decidir)   |
| Setor de Protocolo   | Cadastra alunos, registra comunicações, gera relatórios |
| Comunicante          | Registra CPI ou Referência Elogiosa                    |
| Aluno                | Visualiza as próprias comunicações; toma ciência; defende |

---

## Fluxo de uma CPI

```
Registrada
  → Aguardando Ciência do Aluno
  → Aguardando Defesa (2 dias úteis, sem sábados/domingos)
  → Justificativa Apresentada / Prazo Expirado
  → Aguardando Parecer (Subcomandante ou Oficial — primeiro vale)
  → Aguardando Decisão do Comandante da Escola
  → Decidida → Publicada em Caderno Disciplinar
```

---

## Pontuação (NPCE 2025)

| Tipo                   | Pontos | Natureza     |
|------------------------|--------|--------------|
| CPI 0                  | −0,1   | Desfavorável |
| CPI 1                  | −0,2   | Desfavorável |
| CPI 2                  | −0,4   | Desfavorável |
| CPI 3                  | −0,6   | Desfavorável |
| Referência Elogiosa    | +0,2   | Favorável    |
| Elogio publicado em BI | +1,0   | Favorável    |

**Nota da disciplina** = 10,00 − Σ desfavoráveis + Σ favoráveis
- Aprovação: nota ≥ 6,0 (sem direito a dependência)
- Zona de risco: nota < 7,0

---

## PWA — Instalação no celular

1. Acesse pelo navegador do celular
2. Android (Chrome): menu ⋮ → "Adicionar à tela inicial"
3. iOS (Safari): botão compartilhar → "Adicionar à tela de início"

---

## Documentos imprimíveis

Disponíveis em cada comunicação (botões "Imprimir"):

- Comunicação de CPI / Referência Elogiosa completa
- Termo de Ciência do Aluno
- Parecer (após emissão pelo Subcomandante/Oficial)
- Decisão do Comandante (após decisão)
- Caderno Disciplinar (botão "Imprimir / PDF" na edição)
- Histórico do aluno (botão "Histórico / PDF" na ficha)

Para salvar como PDF: Imprimir → Salvar como PDF no navegador.

---

## Tecnologias utilizadas

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS 4**
- **Prisma 7** + **SQLite** (via @prisma/adapter-libsql)
- **Jose** (sessões JWT stateless)
- **bcryptjs** (hash de senhas)
- **date-fns** (cálculo de prazos úteis)

---

## Próximos pontos para evolução

- Recurso em 1ª e 2ª instância
- Atividades de Ajuste de Conduta Profissional (AACP)
- Notificações por e-mail (nodemailer ou Resend)
- Upload real de anexos (S3, DigitalOcean Spaces ou disco local)
- Migração para PostgreSQL em hospedagem dedicada
- Cadastro de feriados para cálculo de prazos
- Integração com RH da PMES
- Backup automático do banco de dados
