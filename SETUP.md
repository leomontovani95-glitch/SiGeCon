# Instalação do SiGeCon em um computador novo

Guia rápido para colocar o sistema rodando do zero (ex.: outro PC).

## Pré-requisitos
- **Node.js 20+** (https://nodejs.org)
- **Git** (https://git-scm.com)
- Opcionais: GitHub CLI (`gh`), Git Bash. (No Windows, o restante funciona pelo PowerShell.)

## Passo a passo

1. **Clonar o repositório** (público — não precisa de login):
   ```
   git clone https://github.com/leomontovani95-glitch/SiGeCon.git
   cd SiGeCon
   ```

2. **Instalar dependências:**
   ```
   npm install
   ```

3. **Criar o arquivo `.env`** a partir do exemplo:
   - Bash: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`

   Depois edite o `.env` e troque o `SESSION_SECRET` por uma string aleatória de 32+ caracteres.

4. **Preparar o banco** (cria o `dev.db`, aplica as migrações e roda o seed):
   ```
   npm run setup
   ```

5. **Iniciar o servidor:**
   ```
   npm run dev:clean
   ```

6. **Acessar** http://localhost:3000 e entrar com:
   - **Número Funcional:** `000000`
   - **Senha inicial:** `Admin@2026` (troca obrigatória no 1º acesso)

## O que o seed cria
- **1 Administrador** (o acesso acima).
- **9 tipos de comunicação** (TD Leve/Média/Grave, CPI 1/2/3, TAC, Referência Elogiosa, Elogio em BI).
- **227 dispositivos** do Manual do Aluno.
- **Cursos, alunos e demais usuários** são cadastrados pelo Administrador depois de logar.

## Observações
- O banco `dev.db` **não** é versionado (cada instalação tem o seu).
- Para recriar o banco do zero: `npm run db:reset` — **CUIDADO: apaga todos os dados**.

## Atalho com o Claude Code
Se preferir, abra o Claude Code na pasta desejada e dê o comando:

> Clone `https://github.com/leomontovani95-glitch/SiGeCon.git`, instale as dependências, crie o `.env` a partir do `.env.example` com um `SESSION_SECRET` aleatório, rode `npm run setup` e suba o servidor. Depois me diga a URL e as credenciais.
