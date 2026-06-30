# Revisão UI/UX do projeto web

Escopo: aplicação web completa, exceto o fluxo de criação e preenchimento de diários.

Telas analisadas:

- Login e cadastro
- Estrutura global, cabeçalho, sidebar e navegação mobile
- Dashboard
- Lista e visualização de diários
- Clientes
- Usuários e colaboradores
- Equipamentos e mapa
- Perfil e assinatura digital
- Link público de assinatura
- Assistente IA, ajuda, estados vazios, diálogos, toasts e paginação

## Resumo executivo

O projeto já possui uma base funcional boa, identidade verde reconhecível, suporte a tema escuro e preocupação com responsividade. O principal problema é a falta de um sistema visual aplicado de forma disciplinada.

As telas parecem pertencer à mesma família, mas não ao mesmo produto finalizado. Há diferenças frequentes em:

- tamanho e estrutura dos cabeçalhos;
- raio, borda e sombra dos cards;
- comportamento de botões;
- densidade das telas;
- uso de cores semânticas;
- modais e painéis flutuantes;
- animações e efeitos de hover.

O melhor caminho não é redesenhar cada tela isoladamente. Primeiro deve ser criada uma fundação visual única; depois, as telas devem ser migradas para ela.

## Prioridades

### P0 - Corrigir primeiro

#### 1. Simplificar a navegação mobile

Atualmente existem três mecanismos concorrentes:

- botão de voltar ou menu no cabeçalho;
- menu lateral móvel;
- navegação fixa inferior.

Para administradores, a barra inferior ainda substitui Perfil por Clientes e Usuários, enquanto Equipamentos fica apenas no menu lateral. Isso dificulta criar um modelo mental estável.

Recomendação:

- manter a barra inferior com no máximo quatro destinos fixos: Início, Diários, Equipamentos e Perfil;
- manter o botão central de novo diário somente se ele for realmente a ação principal;
- colocar Clientes e Usuários em uma área “Gestão” acessada pelo menu ou Dashboard;
- não substituir destinos pessoais por administrativos conforme a função do usuário;
- mostrar sempre um título da página atual no cabeçalho mobile.

Arquivos relacionados:

- `src/components/Layout.tsx`
- `src/components/BottomNav.tsx`

#### 2. Resolver a competição entre elementos flutuantes

O Assistente IA, a Ajuda e a navegação inferior usam a mesma região da tela. Os dois painéis flutuantes possuem comportamento e aparência muito parecidos, mas são recursos diferentes.

Impactos:

- poluição visual;
- risco de sobreposição;
- dúvida sobre qual recurso usar;
- excesso de elementos fixos no mobile.

Recomendação:

- unificar Ajuda e Assistente em um único botão “Central de ajuda”;
- dentro do painel, usar abas “Ajuda” e “Assistente”;
- no desktop, integrar o painel à lateral direita;
- no mobile, abrir como bottom sheet de tela quase inteira;
- ocultar o recurso nas telas em que não há contexto útil.

Arquivos relacionados:

- `src/components/AgentAssistant.tsx`
- `src/components/DiaryHelp.tsx`
- `src/components/Layout.tsx`

#### 3. Reduzir drasticamente animações de escala

Há muitos `hover:scale-*`, `transition-all`, rotações e sombras crescentes em botões, cards, ícones e itens de navegação. Individualmente parecem sutis; juntos fazem a interface parecer inquieta e menos profissional.

Recomendação:

- remover escala de cards, sidebar, logo e botões comuns;
- reservar escala apenas para ações promocionais ou muito especiais;
- usar mudança de fundo, borda e sombra leve como feedback padrão;
- trocar `transition-all` por propriedades específicas;
- manter duração entre 120 e 180 ms;
- remover animações “glitch”, “tilt” e “float” do sistema visual principal.

Arquivos relacionados:

- `src/index.css`
- `tailwind.config.js`
- diversos componentes em `src/components`

#### 4. Criar componentes estruturais reutilizáveis

Os cabeçalhos de Clientes, Usuários e Diários são semelhantes, mas implementados separadamente. Cards, filtros e modais também variam bastante.

Criar:

- `PageHeader`: título, descrição, ação principal e ações secundárias;
- `FilterBar`: busca, filtros, limpar e exportação;
- `Card`: variantes padrão, selecionável e interativo;
- `DataList`: tabela desktop e cards mobile;
- `Modal`: cabeçalho, conteúdo rolável e rodapé fixo;
- `SectionHeader`;
- `StatusBadge`;
- `IconButton`;
- `FormField`.

Benefício: melhora visual, manutenção e acessibilidade ao mesmo tempo.

### P1 - Alto impacto

#### 5. Padronizar hierarquia das páginas

Hoje há pelo menos três padrões:

- Dashboard com banner grande;
- páginas administrativas com título e botão;
- Equipamentos com uma pequena legenda acima do título;
- Perfil centralizado e estreito;
- visualização de diário sem um cabeçalho de contexto completo.

Padrão recomendado:

1. breadcrumb ou categoria pequena, quando necessário;
2. título de 28-32 px no desktop e 22-24 px no mobile;
3. descrição curta;
4. ação principal à direita;
5. conteúdo começando após 24 px.

Evitar títulos excessivamente longos como “Gerenciamento de Clientes”. Preferir:

- Clientes
- Usuários
- Equipamentos
- Meu perfil
- Diários

#### 6. Padronizar cores semânticas

O verde deve representar marca e ação principal. Atualmente o Dashboard usa verde, azul, roxo e laranja como ações principais; badges também alternam azul, amarelo, verde e vermelho sem uma regra totalmente consistente.

Recomendação:

- verde: ação principal, sucesso e marca;
- azul: informação neutra;
- âmbar: pendência e atenção;
- vermelho: erro e destruição;
- cinza: estados neutros e ações secundárias;
- roxo e laranja somente quando representam categorias reais.

#### 7. Melhorar acessibilidade de interações

Há botões apenas com ícone que dependem de `title`, modais sem semântica completa e controles sem indicação clara de foco.

Recomendação:

- adicionar `aria-label` a todos os botões de ícone;
- usar `role="dialog"`, `aria-modal="true"` e título associado nos modais;
- fechar modais com `Escape`;
- prender o foco dentro do modal;
- devolver o foco ao botão que abriu o modal;
- garantir foco visível consistente;
- usar `aria-live` nos toasts;
- adicionar rótulo acessível à paginação;
- garantir alvos de toque de pelo menos 44 x 44 px.

#### 8. Melhorar o comportamento de modais

Clientes, Usuários e confirmações usam implementações diferentes. Os modais longos de usuário podem ficar cansativos e o rodapé pode sair da área visível.

Recomendação:

- modal padrão com largura por tamanho (`sm`, `md`, `lg`);
- cabeçalho e rodapé fixos;
- conteúdo interno rolável;
- botão principal sempre à direita no desktop e primeiro visualmente no mobile;
- mensagem de erro junto ao campo correspondente;
- confirmação destrutiva exigindo contexto mais claro.

## Revisão por tela

### Login e cadastro

Pontos positivos:

- formulário simples;
- bom contraste;
- campos grandes;
- identidade da marca presente.

Problemas:

- logo, nome e subtítulo ocupam espaço excessivo, especialmente no desktop;
- o título “Geoteste” chega a tamanhos próximos de uma landing page promocional;
- login e cadastro usam o mesmo peso visual, embora cadastro seja uma ação secundária;
- não há recuperação de senha;
- criar conta diretamente na tela pode conflitar com o gerenciamento administrativo de usuários;
- falta uma explicação curta sobre acesso autorizado.

Melhorias:

- usar layout dividido no desktop: marca/informação à esquerda e formulário à direita;
- reduzir a escala do logo e título;
- adicionar “Esqueci minha senha”;
- transformar “Criar conta” em ação secundária ou remover caso contas sejam criadas por administradores;
- incluir mensagem de segurança e suporte;
- manter o formulário com largura entre 400 e 460 px.

### Estrutura global

Pontos positivos:

- sidebar desktop é simples;
- tema escuro já está integrado;
- cabeçalho é fixo e funcional.

Problemas:

- cabeçalho mostra a marca, mas não informa claramente qual página está aberta;
- sidebar tem “Novo Diário” como destino comum, embora seja uma ação;
- uso simultâneo de ícones parecidos para Diários e Novo Diário;
- Perfil usa ícone de usuário na sidebar e ícone de usuários na barra mobile;
- logout aparece em mais de um lugar no mobile;
- largura fixa da sidebar não oferece versão recolhida.

Melhorias:

- separar navegação de ações;
- incluir título da página atual no cabeçalho;
- permitir sidebar compacta no desktop;
- manter Perfil e Logout em um menu da conta;
- remover logout duplicado;
- usar ícone `PlusCircle` ou ação destacada para Novo Diário.

### Dashboard

Pontos positivos:

- boa leitura rápida;
- estados de carregamento;
- atividade recente;
- ações rápidas úteis.

Problemas:

- banner de saudação ocupa muito espaço sem trazer informação operacional;
- estatísticas, ações rápidas e sidebar repetem destinos;
- quatro ações rápidas com quatro cores diferentes parecem atalhos de outro produto;
- cards clicáveis não são elementos `button`;
- falta foco em pendências importantes, especialmente diários aguardando assinatura;
- não há visão temporal ou comparação.

Melhorias:

- reduzir o banner para uma faixa compacta com nome e data;
- priorizar um card de pendências;
- mostrar “aguardando assinatura”, “assinados recentemente” e “links expirando”;
- reduzir ações rápidas a duas ou três;
- usar verde como principal e cards neutros para o restante;
- adicionar tendência de período apenas quando os dados forem confiáveis.

### Lista de diários

Pontos positivos:

- filtros completos;
- estados de assinatura visíveis;
- ações de exportação;
- visualização e geração de link integradas.

Problemas:

- filtro contém busca, duas datas, cliente, tipo, exportação e limpar em uma única grade densa;
- cards apresentam muitos badges simultâneos;
- “Finalizado” parece sempre presente e perde valor informativo;
- card inteiro aparenta ser clicável, mas a ação clara está em um pequeno ícone;
- ícones de editar e excluir são pequenos;
- exportar Excel fica misturado com filtros;
- visualização do PDF fica presa em uma caixa com rolagem interna;
- ações da visualização não possuem agrupamento por importância.

Melhorias:

- busca sempre visível e filtros avançados recolhíveis;
- mostrar filtros ativos como chips;
- mover exportação para menu “Exportar”;
- remover badge “Finalizado” se não houver outros estados;
- tornar o card realmente clicável e manter ações secundárias em menu;
- separar status do diário de status da assinatura;
- na visualização, usar barra de ações fixa: Voltar, Assinatura, Exportar;
- oferecer abrir PDF em tela cheia.

### Clientes

Pontos positivos:

- grid simples;
- informações relevantes;
- estado vazio adequado.

Problemas:

- cards crescem 5% no hover, causando movimento excessivo;
- card possui cursor de clique, mas clicar no card não executa uma ação;
- atualizar está dentro do campo de busca, o que mistura funções;
- edição e exclusão aparecem como pequenos ícones;
- falta quantidade de diários ou contexto de relacionamento;
- modal não apresenta indicação clara de campos opcionais.

Melhorias:

- remover cursor e escala, ou tornar o card clicável para detalhes;
- criar página ou drawer de detalhes do cliente;
- mostrar quantidade de diários, última atividade e contato principal;
- mover Atualizar para botão de ícone separado;
- usar menu de ações;
- padronizar modal.

### Usuários e colaboradores

Pontos positivos:

- tabela desktop e cards mobile;
- papéis e status visíveis;
- formulário completo.

Problemas:

- título fala apenas em Usuários, mas o formulário mistura usuário, colaborador, cargo e status;
- papéis de acesso e função operacional aparecem no mesmo fluxo sem separação conceitual;
- modal é longo;
- campos opcionais usam textos inconsistentes;
- ações importantes ficam apenas em ícones;
- tabela não oferece filtros por função/status;
- perfil do usuário não possui uma visualização detalhada antes de editar.

Melhorias:

- renomear a área para “Pessoas” ou separar Usuários e Colaboradores;
- separar “Acesso ao sistema” de “Dados profissionais” no modal;
- usar etapas ou seções;
- adicionar filtros por acesso, cargo e status;
- abrir detalhes em drawer;
- mostrar último acesso, equipe e equipamentos associados;
- usar menu de ações.

### Equipamentos e mapa

Pontos positivos:

- fluxo completo em uma tela;
- mapa, filtros, formulário e lista conectados;
- status visíveis.

Problemas:

- é a tela mais densa do sistema;
- formulário de cadastro fica permanentemente aberto, mesmo para quem só quer consultar o mapa;
- filtros de status aparecem novamente como legenda;
- mapa, lista, formulário e colaboradores competem pela atenção;
- latitude e longitude ficam expostas como campos principais;
- lista de equipamentos repete ações já presentes no mapa;
- muitos cards grandes tornam a página longa.

Melhorias:

- começar com mapa + lista;
- abrir cadastro/edição em drawer lateral;
- esconder coordenadas em seção avançada;
- unificar filtro e legenda;
- usar painel de detalhes ao selecionar marcador;
- mover colaboradores/equipes para abas do equipamento;
- no mobile, alternar entre Mapa e Lista;
- manter um botão flutuante ou ação no cabeçalho para cadastrar.

### Perfil

Pontos positivos:

- conteúdo focado;
- edição de foto, CPF e assinatura;
- feedback de sucesso/erro.

Problemas:

- CPF fica dentro do bloco de identidade visual, gerando composição apertada;
- edição de foto possui muitas ações simultâneas;
- perfil e assinatura usam cards grandes e cabeçalhos verdes antigos;
- a assinatura atual é exibida em uma caixa pouco refinada;
- explicação “Como funciona” ocupa espaço permanente;
- largura máxima estreita pode gerar página longa desnecessariamente.

Melhorias:

- organizar em abas: Perfil, Segurança e Assinatura;
- usar formulário de dados pessoais em duas colunas no desktop;
- simplificar foto para “Alterar foto” e menu de remoção;
- apresentar assinatura como cartão de prévia;
- mover explicações para texto auxiliar recolhível;
- mostrar estado de completude do perfil.

### Link público de assinatura

Estado atual:

- após o redesenho, possui identidade mais clara, fluxo em etapas e melhor hierarquia.

Melhorias restantes:

- adicionar checkbox explícito de confirmação antes de assinar;
- oferecer botão “Abrir documento em tela cheia”;
- mostrar feedback claro quando a assinatura foi salva, antes da confirmação final;
- informar que a assinatura é única e registrar data/hora;
- após concluir, apresentar recibo visual e opção de baixar o diário assinado;
- revisar carregamento do PDF em conexões lentas.

### Assistente IA e ajuda

Problemas:

- recursos visualmente semelhantes e separados;
- tooltip permanente “Precisa de ajuda?” cria ruído;
- painel pequeno para respostas longas;
- contexto do assistente é limitado;
- ajuda é focada apenas no diário, mas aparece globalmente.

Melhorias:

- unificar os recursos;
- usar painel lateral no desktop e tela cheia no mobile;
- exibir título, histórico e contexto atual;
- mostrar sugestões iniciais;
- ocultar ajuda de diário fora da área de diários;
- remover tooltip permanente.

## Componentes transversais

### Botões

Definir apenas:

- primário;
- secundário;
- discreto/ghost;
- destrutivo;
- ícone;
- link.

Evitar cores diferentes para ações comuns e remover escala no hover.

### Cards

Definir:

- card padrão: borda sutil, sem escala;
- card interativo: borda e fundo alterados no hover;
- card selecionado: borda verde e fundo verde muito leve;
- card de métrica: número, rótulo e tendência.

### Formulários

- padronizar altura, raio e foco;
- marcar obrigatórios de forma consistente;
- usar texto auxiliar abaixo do campo;
- apresentar erros junto ao campo;
- evitar “(opcional)” repetido em muitos rótulos; informar obrigatoriedade no início do formulário;
- usar máscaras para telefone e CPF;
- incluir estados de salvamento e sucesso no próprio formulário.

### Tabelas e listas

- cabeçalho fixo para listas longas;
- ordenação;
- filtros ativos;
- menu de ações;
- seleção em massa apenas se houver caso de uso;
- densidade confortável/padrão;
- versão mobile em cards com as mesmas prioridades da tabela.

### Feedback

- unificar toasts e mensagens locais;
- `aria-live` para mensagens;
- evitar mostrar o mesmo sucesso em toast e dentro do card;
- carregamentos devem preservar a estrutura da tela;
- usar estados vazios menores em áreas secundárias.

## Sistema visual proposto

### Escala de espaçamento

- 4 px: micro espaçamento
- 8 px: elementos relacionados
- 12 px: grupos compactos
- 16 px: conteúdo de cards
- 24 px: separação de seções
- 32 px: separação principal

### Raios

- campos e botões: 10 px
- cards: 14 px
- modais e painéis importantes: 18 px
- badges: totalmente arredondados

### Sombras

- cards normais: quase sem sombra;
- cards elevados e menus: sombra média;
- modais: sombra forte;
- evitar sombra e escala simultaneamente no hover.

### Tipografia

- título de página: 28 px / 700;
- título de seção: 18-20 px / 600;
- título de card: 15-16 px / 600;
- corpo: 14 px / 400;
- auxiliar: 12 px / 400;
- evitar excesso de textos com 10 px.

## Plano recomendado

### Fase 1 - Fundação

1. Criar componentes estruturais reutilizáveis.
2. Padronizar botões, cards, campos, badges, modais e cabeçalhos.
3. Remover escalas e animações excessivas.
4. Corrigir navegação mobile e elementos flutuantes.
5. Aplicar requisitos básicos de acessibilidade.

### Fase 2 - Telas principais

1. Lista e visualização de diários.
2. Dashboard.
3. Equipamentos e mapa.
4. Usuários/colaboradores.
5. Clientes.
6. Perfil.

### Fase 3 - Acabamento

1. Login.
2. Assistente e ajuda unificados.
3. Estados vazios, toasts e carregamentos.
4. Tema escuro.
5. Testes responsivos e de teclado.

## Critérios de sucesso

- qualquer tela deve parecer parte do mesmo sistema sem depender do logo;
- usuário deve identificar a ação principal em menos de três segundos;
- mobile não deve apresentar mais de um elemento flutuante global;
- cards não devem se mover ao passar o mouse;
- todos os modais devem funcionar por teclado;
- ações destrutivas devem estar visualmente separadas;
- filtros não devem dominar a tela;
- a mesma informação não deve aparecer em navegação, ação rápida e card sem necessidade;
- componentes equivalentes devem possuir a mesma aparência e comportamento.
