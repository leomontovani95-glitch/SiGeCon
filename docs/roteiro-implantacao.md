# SiGeCon — Roteiro de implantação (rascunho)

Passo a passo para colocar o sistema no ar no servidor da PMES. É um **rascunho**: os
trechos marcados com `⟨…⟩` dependem das respostas da TI (ver
[implantacao-perguntas-ti.md](implantacao-perguntas-ti.md)) e os blocos com **[ESCOLHA]**
têm caminhos alternativos — usar só o que corresponder ao ambiente real.

Stack: **Next.js 16** (Node.js) + **Prisma 7** + **SQLite** (padrão).

---

## 0. Pré-requisitos no servidor

- [ ] **Node.js LTS** instalado (≥ 20). Conferir: `node -v` e `npm -v`.
- [ ] Acesso ao diretório onde o app vai morar (ex.: `⟨C:\apps\sigecon⟩` ou `⟨/opt/sigecon⟩`).
- [ ] Definido se o servidor tem internet para `npm` ou se as dependências vão empacotadas (ver perguntas 6–7).
- [ ] Definidos domínio/porta/HTTPS/proxy (perguntas 8–12).

## 1. Obter o código no servidor

**[ESCOLHA] conforme a forma de entrega (pergunta 30):**
- **Git interno:** `git clone ⟨url⟩ sigecon` e depois `git checkout main`.
- **Pacote (zip):** copiar o projeto para o servidor e descompactar (sem `node_modules` e sem `.next`).

> Não copiar `.env`, `dev.db`, `uploads/` nem `.next/` da máquina de desenvolvimento — produção tem os seus próprios.

## 2. Variáveis de ambiente (`.env`)

Criar o arquivo `.env` na raiz do projeto. **Não versionar.**

```env
# Banco SQLite (arquivo). Caminho do arquivo de produção (pergunta 19).
DATABASE_URL="file:⟨./prod.db⟩"

# Chave de assinatura da sessão — GERAR uma aleatória e forte (32+ caracteres).
# NUNCA reaproveitar a de desenvolvimento.
SESSION_SECRET="⟨GERAR — ver abaixo⟩"

# Pasta dos anexos enviados (defesas/provas/pareceres). FORA de public/.
# Apontar para um local com backup (pergunta 20).
UPLOADS_DIR="⟨C:\apps\sigecon\uploads  ou  /var/lib/sigecon/uploads⟩"

# Fuso horário (o app também fixa internamente, mas é boa prática no ambiente).
TZ="America/Sao_Paulo"

# Porta interna do Node (opcional; padrão 3000). Ver pergunta 12.
# PORT=3000
```

**Gerar o `SESSION_SECRET`:**
- Node (qualquer SO): `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## 3. Instalar dependências

```bash
npm ci          # instalação limpa a partir do package-lock (reproduzível)
```
*(Se o servidor não tiver internet, levar o `node_modules` já instalado ou um cache offline — definir com a TI.)*

## 4. Gerar o cliente Prisma

```bash
npm run db:generate     # = prisma generate
```

## 5. Criar o banco e os dados iniciais

> O schema já está em sincronia com as migrações (verificado): `migrate deploy` cria o
> banco do zero corretamente. **Usar `migrate deploy`, nunca `migrate dev` em produção.**

```bash
npx prisma migrate deploy     # cria/atualiza o schema no banco de produção
npm run seed                  # cria o ADMINISTRADOR inicial + tipos + Manual do Aluno
```

**Acesso inicial criado pelo seed** (trocar a senha no 1º acesso — já é obrigatório):
- Número Funcional: `000000`
- Senha inicial: `Admin@2026`

## 6. Build de produção

```bash
npm run build
```
*(Opcional, recomendado antes do build: `npm run check` — typecheck + lint + testes.)*

## 7. Subir a aplicação

O comando base é `npm run start` (sobe o Next em modo produção na porta definida). Para o
app reiniciar sozinho após reboot/queda, registrar como serviço.

**[ESCOLHA] conforme o SO e o gerenciador de processo (perguntas 1, 15):**

- **Windows — serviço:** registrar via NSSM ou Task Scheduler executando `npm run start`
  no diretório do projeto, com início automático e reinício em caso de falha.
- **Linux — systemd:** criar uma unit (`sigecon.service`) com `ExecStart=npm run start`,
  `WorkingDirectory=⟨/opt/sigecon⟩`, `Restart=always`, e variáveis de ambiente do `.env`.
- **PM2 (Windows ou Linux):** `pm2 start npm --name sigecon -- start` + `pm2 save` +
  `pm2 startup` (para subir no boot).

> Confirmar que o processo enxerga o `.env` (algumas configurações de serviço não herdam o
> ambiente do usuário — pode ser preciso apontar o arquivo ou definir as variáveis na unit/serviço).

## 8. Proxy reverso e HTTPS

O Node não deve ser exposto direto à rede; fica atrás de um proxy que trata HTTPS
(perguntas 10–11).

**[ESCOLHA] conforme o proxy:**
- **IIS (Windows):** ARR + URL Rewrite encaminhando para `http://localhost:⟨3000⟩`.
- **Nginx (Linux):** `proxy_pass http://localhost:⟨3000⟩;` no `server` do domínio.

Em qualquer caso, o proxy deve repassar os cabeçalhos: `X-Forwarded-For`,
`X-Forwarded-Proto`, `Host` (para o app reconhecer IP real e HTTPS).

**Após o HTTPS estar funcionando:**
- [ ] Descomentar o **HSTS** em [`next.config.ts`](../next.config.ts) (linha do
  `Strict-Transport-Security`) e refazer o `build`.
- [ ] Confirmar que os cookies de sessão saem como `Secure` (o app já faz isso quando
  `NODE_ENV=production`).

## 9. Pós-implantação (primeiro acesso)

- [ ] Entrar com `000000` / `Admin@2026` e **trocar a senha** (obrigatório).
- [ ] Cadastrar os **usuários reais** (gestores, comandantes, etc.) e suas escolas.
- [ ] Cadastrar **cursos, pelotões e alunos**.
- [ ] Conferir os **Tipos de Comunicação** e o **Manual do Aluno** (criados pelo seed) e ajustar conforme a legislação vigente.

## 10. Backup

> Hoje há backup **manual** sob demanda em `/api/admin/backup` (baixa o arquivo do banco).
> Para produção, combinar com a TI um **backup automático** (pergunta 21).

- [ ] Backup automático **diário** de: arquivo do banco (`⟨prod.db⟩`) **e** pasta de anexos (`UPLOADS_DIR`).
- [ ] Guardar cópias **fora do servidor** (retenção a definir).
- [ ] Para o banco, preferir copiar com o WAL descarregado (o endpoint de backup já faz `checkpoint`; um job externo pode usar o comando de backup do SQLite).

## 11. Verificação final (smoke test)

- [ ] Acessar pelo domínio em **HTTPS**; login funciona.
- [ ] Registrar uma comunicação de teste e **anexar um arquivo**; reabrir e baixar o anexo (deve exigir login).
- [ ] Conferir que um anexo **não** abre sem sessão (testar a URL `/api/anexo/⟨id⟩` deslogado → redireciona/nega).
- [ ] Gerar um **PDF** (ranking ou caderno) e conferir.
- [ ] Conferir os **headers de segurança** na resposta (X-Frame-Options, X-Content-Type-Options, Referrer-Policy; e HSTS se já em HTTPS).
- [ ] Reiniciar o servidor e confirmar que o app **sobe sozinho**.

## 12. Pendências técnicas a fechar junto com a infra

- [ ] **#6 — SQLite WAL + `busy_timeout`** em `lib/db.ts` (evita erro de banco travado com escrita concorrente). Aplicar antes de muitos usuários simultâneos.
- [ ] **HSTS** — descomentar após HTTPS (passo 8).
- [ ] **CSP** — avaliar numa etapa posterior (exige nonce no script do service worker + teste).
- [ ] **SQLite × PostgreSQL** — reavaliar conforme o nº de usuários simultâneos (perguntas 17–18).
- [ ] **Login integrado (AD/LDAP)** — se a TI exigir, é escopo adicional (pergunta 25).

---

*Atualizar este roteiro à medida que as respostas da TI forem chegando, fixando os valores `⟨…⟩` e removendo os caminhos `[ESCOLHA]` não usados.*
