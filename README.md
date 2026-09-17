# 📝 Geoteste - Sistema de Diários de Obra

Sistema web para gerenciamento de diários de obra da Geoteste, com suporte a múltiplos tipos de ensaios e geração automática de PDFs.

🌐 **Deploy:** [diariosgeoteste.vercel.app](https://diariosgeoteste.vercel.app)

## 🚀 Funcionalidades

- ✅ Autenticação de usuários com Supabase
- ✅ Gerenciamento de clientes
- ✅ Criação de diários de obra para diferentes tipos de ensaios:
  - **PCE** (Prova de Carga Estática)
  - **PIT** (Prova de Integridade de Estacas)
  - **PLACA** (Ensaio de Placa)
  - **PDA** (Prova Dinâmica de Análise)
  - **PDA Diário** (Diário detalhado de PDA)
- ✅ Geração automática de PDFs
- ✅ Exportação para Excel e CSV
- ✅ Assinatura digital nos diários
- ✅ Interface responsiva e moderna
- ✅ PWA (Progressive Web App) para instalação mobile
- ✅ Modo escuro

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no [Supabase](https://supabase.com) (para autenticação e banco de dados)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/MistoFrio/Diariosgeoteste.git
cd Diariosgeoteste
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
   - Crie um arquivo `.env` na raiz do projeto
   - Copie o conteúdo de `.env.example` (se existir)
   - Adicione suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

4. Rode o projeto em desenvolvimento:
```bash
npm run dev
```

O sistema estará disponível em `http://localhost:5173`

## 🌐 Deploy

### Deploy no Netlify

1. Faça deploy pelo Git ou arraste a pasta `dist` no Netlify
2. **IMPORTANTE:** Configure as variáveis de ambiente no Netlify:
   - Vá em **Site settings** > **Environment variables**
   - Adicione:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

3. Configure as URLs autorizadas no Supabase:
   - **Authentication** > **URL Configuration**
   - Adicione a URL do Netlify em **Redirect URLs**

📖 **Guia completo:** [tutoriais/CONFIGURAR_NETLIFY.md](tutoriais/CONFIGURAR_NETLIFY.md)

### Deploy no Vercel

Similar ao Netlify, configure as variáveis de ambiente em **Settings** > **Environment Variables**

## 📱 Gerar APK (Android)

Para gerar um APK para Android:

```bash
npm run build
npx cap sync
npx cap open android
```

📖 **Guia completo:** [tutoriais/BUILD_APK.md](tutoriais/BUILD_APK.md)

## 🗄️ Banco de Dados

O projeto usa Supabase com PostgreSQL. Os scripts SQL estão em `banco de dados/`:

- `supabase.sql` - Script completo de criação do banco
- Outros arquivos - Migrações e ajustes específicos

## 🔐 Autenticação

O sistema suporta dois modos:

### Modo Supabase (Produção)
- Autenticação real com banco de dados
- Dados sincronizados entre dispositivos
- Requer configuração das variáveis de ambiente

### Modo Local (Desenvolvimento)
- Funciona sem configuração do Supabase
- Dados armazenados apenas no localStorage
- Usuário padrão:
  - Email: `admin@geoteste.com`
  - Senha: `123456`

## 📚 Tutoriais

- [CONFIGURAR_NETLIFY.md](tutoriais/CONFIGURAR_NETLIFY.md) - Como configurar deploy no Netlify
- [DEPLOY.md](tutoriais/DEPLOY.md) - Guia de deploy completo
- [BUILD_APK.md](tutoriais/BUILD_APK.md) - Como gerar APK Android
- [GUIA_RAPIDO_APK.md](tutoriais/GUIA_RAPIDO_APK.md) - Guia rápido de APK
- [MOBILE_FEATURES.md](tutoriais/MOBILE_FEATURES.md) - Funcionalidades mobile
- [DESIGN_ANALYSIS.md](tutoriais/DESIGN_ANALYSIS.md) - Análise de design

## 🛠️ Tecnologias

- **Frontend:** React 18 + TypeScript + Vite
- **Estilização:** Tailwind CSS
- **Autenticação:** Supabase Auth
- **Banco de Dados:** Supabase (PostgreSQL)
- **PDFs:** jsPDF
- **Excel:** xlsx
- **Mobile:** Capacitor (para APK)
- **Deploy:** Netlify / Vercel

## Sincronização dos ensaios PIT

O botão **Sincronizar ensaios** do diário PIT consulta os arquivos enviados pelo equipamento na data do diário. A leitura do projeto `fpit-sync` acontece somente na Netlify Function; a chave administrativa nunca é enviada ao navegador.

Configure estas variáveis no ambiente do Netlify:

```text
PIT_SUPABASE_URL=https://mphomlxniavqmvxhacii.supabase.co
PIT_SUPABASE_SERVICE_ROLE_KEY=<service role do projeto fpit-sync>
VITE_SUPABASE_URL=<URL do projeto do Diário>
VITE_SUPABASE_ANON_KEY=<anon key do projeto do Diário>
```

Qualquer usuário autenticado no Diário pode sincronizar. O técnico escolhe a pasta de origem antes da importação; o app preenche nome da estaca, diâmetro e comprimento útil como sugestões, enquanto tipo e arrasamento continuam manuais.

## Sincronização de obras do Pipefy

Quando um card novo entra no pipe **"02-Gestão de Obras - Geoteste"** (isso acontece quando o time comercial fecha contrato, via o conector "Criar Obra Fechada" no CRM), o Pipefy chama um webhook que cria Cliente (se ainda não existir) e Obra automaticamente no Diário — sem revisão manual.

A function usa o código da obra e o nome da empresa que já vêm resolvidos no card mestre do pipe/database "Obras (Geoteste)" (campos "Número da Obra" e "Empresa"), então não recalcula nada — só espelha o que está no Pipefy.

Configure estas variáveis no ambiente do Netlify:

```text
PIPEFY_API_TOKEN=<token pessoal do Pipefy usado para ler os cards>
PIPEFY_WEBHOOK_SECRET=<string aleatória — validada no header x-webhook-secret>
SUPABASE_SERVICE_ROLE_KEY=<service role do PRÓPRIO projeto do Diário>
```

`SUPABASE_SERVICE_ROLE_KEY` é diferente do `PIT_SUPABASE_SERVICE_ROLE_KEY` (aquele é do projeto `fpit-sync`, este é do projeto do Diário) — ele é o que dá à function permissão de escrever em `clients`/`obras` sem estar logada como usuário.

Depois de configurar e fazer o deploy, o webhook é registrado do lado do Pipefy uma única vez (mutation `createWebhook`, action `card.create`, pipe `304603301`, header `x-webhook-secret`), não precisa refazer isso a cada deploy.

## Propostas comerciais (autopreenchimento do PDF)

A aba **Propostas** lê o PDF padrão de proposta comercial da Geoteste (capa + "Dados Iniciais" + tabela de orçamento + condições de pagamento) e autopreenche o formulário — cliente, CNPJ, obra, endereço, modalidade (PIT/PDA/PCE/PLACA/HAMMER), itens do orçamento, valor total, condições de pagamento etc. O admin sempre revisa/edita antes de salvar, já que a extração é por rótulo de texto (não é 100% garantida em modelos muito fora do padrão).

A extração roda na Netlify Function `parse-proposta-pdf` (usa `pdfjs-dist` no modo "legacy", só lê texto, não renderiza páginas — não precisa de credencial nenhuma). O dashboard da própria aba calcula, a partir das propostas salvas: valor enviado por modalidade, taxa de conversão (aceitas/decididas) por modalidade, filtro por período (hoje/7 dias/30 dias/tudo) e por cidade.

Rode `banco de dados/create_propostas.sql` uma vez no SQL Editor do Supabase antes de usar essa aba.

## Consultas WhatsApp (Evolution API)

A sub-aba **Comercial > Consultas WhatsApp** loga a primeira mensagem de cada número novo que chega pela instância do WhatsApp (Evolution API) — mensagens seguintes da mesma conversa não geram uma consulta nova, só a primeira conta. Qualificação (qualificada/desqualificada + motivo) e origem (marketing, orgânico, indicação etc.) são preenchidas manualmente por enquanto; cruzar automaticamente com o tracking de head/UTM das campanhas fica para depois.

A function `evolution-webhook` recebe o evento `messages.upsert` da Evolution API. Configure na Evolution API (por instância, endpoint de webhooks) a URL:

```text
https://<seu-site>.netlify.app/.netlify/functions/evolution-webhook?secret=<EVOLUTION_WEBHOOK_SECRET>
```

Ou, se a sua versão da Evolution API permitir header customizado no webhook, pode mandar `x-webhook-secret` no header em vez do `?secret=` na URL — a function aceita qualquer um dos dois.

Configure esta variável no ambiente do Netlify:

```text
EVOLUTION_WEBHOOK_SECRET=<string aleatória — a mesma usada na URL/header do webhook>
```

Reaproveita `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (já configuradas pela integração do Pipefy) — não precisa de credencial nova além do secret do webhook.

O payload da Evolution API segue o padrão do evento `messages.upsert` (baseado em Baileys); os campos exatos (`data.message.conversation` etc.) ainda não foram validados contra uma instância real — no primeiro teste ao vivo, pode ser necessário ajustar a extração de texto/contato na function, do mesmo jeito que aconteceu com o parser de PDF de propostas.

Rode `banco de dados/create_consultas_whatsapp.sql` uma vez no SQL Editor do Supabase antes de usar essa aba.

## 📝 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview da build
npm run lint         # Verificar código
```

## 🐛 Solução de Problemas

### Login não funciona no Netlify/Vercel

**Causa:** Variáveis de ambiente não configuradas

**Solução:** Veja o guia [CONFIGURAR_NETLIFY.md](tutoriais/CONFIGURAR_NETLIFY.md)

### Erro de CORS

**Solução:** Configure as URLs autorizadas no Supabase (Authentication > URL Configuration)

### Service Worker em desenvolvimento

Se o cache está causando problemas em desenvolvimento, limpe o cache do navegador ou desabilite o Service Worker.

## 📄 Licença

Este projeto é privado e pertence à Geoteste.

## 👤 Autor

Desenvolvido para Geoteste

