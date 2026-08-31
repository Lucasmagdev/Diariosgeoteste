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

Qualquer usuário autenticado no Diário pode sincronizar. O técnico escolhe a pasta de origem antes da importação; o app preenche nome da estaca, diâmetro e profundidade como sugestões, enquanto tipo e arrasamento continuam manuais.

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

