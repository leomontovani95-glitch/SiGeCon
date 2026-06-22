# SiGeCon — Levantamento para implantação no servidor da PMES

Documento para alinhamento com a equipe de TI/infraestrutura responsável pelo servidor.
Cada item traz a pergunta e, em itálico, **por que ela importa** (o que a resposta muda na
preparação do sistema). O SiGeCon é uma aplicação web **Next.js 16** (Node.js) com banco
**SQLite** (arquivo único) por padrão.

---

## 1. Servidor e sistema operacional

1. Qual o **sistema operacional** do servidor (Windows Server? Qual versão? Linux? Qual distribuição)?
   *Define como o app é instalado, iniciado e mantido no ar (serviço do Windows × systemd no Linux).*
2. Teremos **acesso administrativo** ao servidor para instalar e configurar, ou a instalação é feita só pela equipe de TI?
   *Define quem executa cada passo e se precisamos preparar um roteiro de instalação.*
3. Qual o **hardware/recursos** disponíveis (CPU, memória RAM, espaço em disco)?
   *Next.js + Node consomem RAM no build e em runtime; precisamos confirmar folga (recomendável ≥ 2 GB livres).*
4. O servidor é **físico, máquina virtual ou container**? É compartilhado com outros sistemas?
   *Afeta isolamento, portas disponíveis e concorrência por recursos.*

## 2. Runtime (Node.js)

5. Há **Node.js instalado**? Qual versão? Podemos instalar/atualizar para uma versão LTS recente (≥ 20)?
   *O Next.js 16 exige uma versão moderna do Node; versão antiga impede a execução.*
6. Há **restrição para instalar dependências** via `npm` no servidor (acesso à internet/repositório npm)?
   *Se o servidor não tiver internet, precisamos levar as dependências já empacotadas (build/`node_modules` ou pacote offline).*
7. O servidor tem **acesso à internet de saída**, total, parcial ou nenhum?
   *Define a estratégia de instalação e atualização (online × pacote fechado).*

## 3. Rede, domínio e HTTPS

8. O sistema terá um **endereço/domínio** (ex.: `sigecon.pmes.intra`) ou será acessado por IP?
   *Necessário para configurar o app e os certificados.*
9. O acesso será **só pela rede interna da PMES** ou também externo (internet)?
   *Muda diretamente o nível de exposição e as proteções necessárias.*
10. Haverá **HTTPS (certificado SSL/TLS)**? Quem fornece o certificado (TI institucional, autoridade interna)?
    *HTTPS é pré-requisito para ativar o HSTS e para cookies de sessão seguros. Sem ele, a sessão trafega de forma menos protegida.*
11. Haverá um **proxy reverso à frente** do app (IIS, Nginx, Apache)? Quem o configura?
    *Define como o tráfego chega ao Node (porta interna), e os cabeçalhos de encaminhamento (IP real do usuário, protocolo).*
12. Qual **porta** o app pode usar internamente (padrão 3000)? Há firewall/regras a liberar?
    *Para o app subir sem conflito e o proxy conseguir falar com ele.*
13. Os usuários acessam por trás de um **único IP de saída (NAT)**?
    *Confirma a decisão de limitar tentativas de login por conta (e não por IP), para não bloquear toda a rede.*

## 4. Disponibilidade e inicialização

14. O servidor fica **ligado 24/7**? Há reinícios programados (manutenção, atualização de SO)?
    *O sistema tem uma rotina interna que processa prazos a cada 30 min; ela depende do app estar no ar.*
15. Como o app deve **iniciar automaticamente** após reinício do servidor (serviço do Windows, systemd, PM2)?
    *Para o sistema voltar sozinho sem intervenção manual após queda/reboot.*
16. Há **horário de manutenção** preferencial e procedimento de comunicação a usuários?
    *Para planejar atualizações e backups sem afetar o uso.*

## 5. Banco de dados

17. Quantos **usuários simultâneos** são esperados (pico)? Qual o volume previsto de registros por ano?
    *Decide se o SQLite (padrão, arquivo único) é suficiente ou se vale migrar para PostgreSQL. SQLite atende bem dezenas de usuários; muita escrita concorrente pede Postgres.*
18. A TI tem **PostgreSQL disponível/padronizado**? Há exigência de usar um SGBD institucional?
    *Caso exista política de banco corporativo, planejamos a migração SQLite → Postgres (o sistema suporta).*
19. Onde o **arquivo do banco** pode ficar (caminho no disco)? Esse local entra na rotina de backup da TI?
    *O banco SQLite é um arquivo; precisa de local estável e protegido.*

## 6. Arquivos enviados (anexos) e backup

20. Onde podem ser **armazenados os arquivos anexados** (defesas, provas, pareceres)? Há um volume/pasta com backup?
    *O sistema grava os anexos em disco (pasta `uploads`, configurável); precisa de espaço e backup junto com o banco.*
21. Existe **rotina de backup automático** no servidor (qual ferramenta, qual frequência, retenção)? Podemos incluir o banco e a pasta de anexos?
    *Backup é crítico; hoje o sistema só tem backup manual sob demanda. Idealmente: cópia automática diária para fora do servidor.*
22. Há **política de retenção/expurgo de dados** a observar (LGPD)? Por quanto tempo os registros devem ser mantidos?
    *Dados pessoais de servidores/alunos (maiores de idade) — define se precisamos de regras de retenção/exclusão.*

## 7. Segurança e acesso

23. Quem terá **acesso ao servidor** (administração) e como (RDP, SSH)? Há requisitos de senha/2FA?
    *Para definir responsáveis e proteger o ambiente.*
24. Há **antivírus/EDR** no servidor que possa interferir na escrita de arquivos ou no processo do Node?
    *Evita surpresas (ex.: antivírus bloqueando upload ou o executável).*
25. A PMES tem **diretório de identidade (Active Directory/LDAP)**? Há expectativa de login integrado (usuário de rede) em vez de senha própria do sistema?
    *Hoje o login é próprio (Número Funcional + senha). Se houver exigência de SSO/AD, isso é um trabalho adicional a planejar.*
26. Há **norma/checklist de segurança da informação** institucional que o sistema precise cumprir para ser homologado?
    *Para sabermos antecipadamente os requisitos de aprovação.*

## 8. Operação, logs e monitoramento

27. Para onde devem ir os **logs** do sistema? Há ferramenta de centralização/monitoramento?
    *O sistema gera logs estruturados; precisamos saber onde gravá-los e rotacioná-los.*
28. Há **monitoramento de disponibilidade** (o serviço caiu?) que a TI gostaria de integrar?
    *Para alertar caso o app pare.*
29. Quem será o **ponto de contato** da TI para a implantação e para o suporte depois?
    *Para agilizar a instalação e a manutenção.*

## 9. Implantação e atualizações

30. Como será feita a **entrega/atualização** do sistema (acesso ao servidor por nós, pacote entregue à TI, repositório Git interno)?
    *Define o procedimento de deploy e de futuras correções.*
31. Haverá **ambiente de homologação/teste** separado do de produção?
    *Permite validar atualizações antes de afetar o uso real.*
32. Qual a **data-alvo** para o go-live e há **dados a migrar** de algum sistema anterior?
    *Para planejar cronograma e eventual importação de dados.*

---

### Resumo das definições que mais impactam o sistema

- **HTTPS + domínio + proxy reverso** → liberam HSTS, cookies seguros e o cabeçalho de IP real.
- **Usuários simultâneos / política de SGBD** → decisão SQLite × PostgreSQL.
- **Local de banco e anexos + backup automático** → segurança contra perda de dados.
- **SO + forma de inicialização** → como o app sobe e se mantém no ar.
- **Login integrado (AD/LDAP)?** → se confirmado, é escopo adicional a planejar.
