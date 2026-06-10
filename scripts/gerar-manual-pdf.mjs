// Gera o Manual do Diário em PDF.
// Uso: node scripts/gerar-manual-pdf.mjs
import { jsPDF } from 'jspdf';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tutoriais', 'Manual_do_Diario.pdf');
const LOGO = readFileSync(join(__dirname, '..', 'public', 'logogeoteste.png')).toString('base64');

// Paleta baseada na logo (verde profundo Geoteste)
const BRAND = [21, 107, 79];        // verde da logo
const BRAND_DARK = [13, 74, 54];    // verde escuro
const BRAND_SOFT = [233, 244, 239]; // verde bem claro (fundo)
const INK = [31, 41, 51];           // texto principal
const BODY = [60, 72, 82];          // corpo de texto
const MUTE = [120, 130, 138];       // texto secundário
const LINE = [223, 230, 227];       // linhas/divisores

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const PW = doc.internal.pageSize.getWidth();   // 210
const PH = doc.internal.pageSize.getHeight();  // 297
const MX = 20;                                  // margem lateral
const CW = PW - MX * 2;                         // largura útil
let y = 0;
let onCover = true;

const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

function pageHeader() {
  // faixa fina superior + logo + marca
  doc.addImage(LOGO, 'PNG', MX, 11, 9, 9, 'logo', 'FAST');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(BRAND_DARK);
  doc.text('GEOTESTE', MX + 12, 15.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(MUTE);
  doc.text('Manual do Diário', MX + 12, 19.5);
  setDraw(LINE);
  doc.setLineWidth(0.3);
  doc.line(MX, 24, PW - MX, 24);
}

function footer() {
  if (onCover) return;
  const page = doc.internal.getNumberOfPages();
  setDraw(LINE);
  doc.setLineWidth(0.3);
  doc.line(MX, PH - 12, PW - MX, PH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(MUTE);
  doc.text('Geoteste • Diários de Obra', MX, PH - 8);
  doc.text(String(page), PW - MX, PH - 8, { align: 'right' });
}

function newPage() {
  footer();
  doc.addPage();
  pageHeader();
  y = 32;
}

function ensure(space) {
  if (y + space > PH - 18) newPage();
}

function h1(text) {
  ensure(22);
  y += 2;
  // barra de destaque + título
  setFill(BRAND);
  doc.roundedRect(MX, y, 3.5, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setText(BRAND_DARK);
  doc.text(text, MX + 7, y + 7);
  y += 11;
  setDraw(LINE);
  doc.setLineWidth(0.3);
  doc.line(MX, y, PW - MX, y);
  y += 7;
}

function h2(text) {
  ensure(13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(BRAND);
  doc.text(text, MX, y);
  y += 6.5;
}

function paragraph(text, opts = {}) {
  const size = opts.size || 10;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  setText(opts.color || BODY);
  const lines = doc.splitTextToSize(text, opts.width || CW);
  for (const line of lines) {
    ensure(6);
    doc.text(line, opts.x || MX, y);
    y += size * 0.52;
  }
  y += opts.gap ?? 3;
}

function bullet(text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(BODY);
  const lines = doc.splitTextToSize(text, CW - 7);
  ensure(lines.length * 5.2);
  setFill(BRAND);
  doc.circle(MX + 1.3, y - 1.3, 0.9, 'F');
  doc.text(lines, MX + 5.5, y);
  y += lines.length * 5.2 + 2;
}

function step(num, title, text) {
  const lines = doc.splitTextToSize(text, CW - 20);
  const boxH = 10 + lines.length * 4.8;
  ensure(boxH + 4);
  // cartão
  setFill(BRAND_SOFT);
  doc.roundedRect(MX, y, CW, boxH, 2.5, 2.5, 'F');
  // bolha do número
  setFill(BRAND);
  doc.circle(MX + 9, y + boxH / 2, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setText([255, 255, 255]);
  doc.text(String(num), MX + 9, y + boxH / 2 + 1.5, { align: 'center' });
  // título
  doc.setFontSize(10.5);
  setText(BRAND_DARK);
  doc.text(title, MX + 18, y + 7);
  // texto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(BODY);
  doc.text(lines, MX + 18, y + 12.5);
  y += boxH + 4.5;
}

function tip(text) {
  const lines = doc.splitTextToSize(text, CW - 16);
  const boxH = 7 + lines.length * 4.8;
  ensure(boxH + 4);
  setFill(BRAND_SOFT);
  doc.roundedRect(MX, y, CW, boxH, 2.5, 2.5, 'F');
  setFill(BRAND);
  doc.roundedRect(MX, y, 3, boxH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setText(BRAND);
  doc.text('DICA', MX + 7, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(BRAND_DARK);
  doc.text(lines, MX + 7, y + 11);
  y += boxH + 4.5;
}

function faq(q, a) {
  ensure(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(BRAND_DARK);
  const ql = doc.splitTextToSize(q, CW - 6);
  setFill(BRAND);
  doc.circle(MX + 1.1, y - 1.4, 1, 'F');
  doc.text(ql, MX + 5, y);
  y += ql.length * 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(BODY);
  const al = doc.splitTextToSize(a, CW - 5);
  ensure(al.length * 5);
  doc.text(al, MX + 5, y);
  y += al.length * 5 + 5;
}

/* ====================== CAPA ====================== */
// fundo branco limpo
setFill([255, 255, 255]);
doc.rect(0, 0, PW, PH, 'F');

// faixa superior fina
setFill(BRAND);
doc.rect(0, 0, PW, 6, 'F');

// painel inferior verde
setFill(BRAND);
doc.rect(0, PH - 52, PW, 52, 'F');
setFill(BRAND_DARK);
doc.rect(0, PH - 52, PW, 2.5, 'F');

// logo centralizada em círculo claro
const LOGO_SZ = 46;
doc.addImage(LOGO, 'PNG', PW / 2 - LOGO_SZ / 2, 56, LOGO_SZ, LOGO_SZ, 'logo', 'FAST');

// marca
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
setText(BRAND_DARK);
doc.text('G E O T E S T E', PW / 2, 118, { align: 'center' });
setDraw(BRAND);
doc.setLineWidth(0.5);
doc.line(PW / 2 - 22, 122, PW / 2 + 22, 122);

// título
doc.setFont('helvetica', 'bold');
doc.setFontSize(38);
setText(INK);
doc.text('Manual do Diário', PW / 2, 150, { align: 'center' });

doc.setFont('helvetica', 'normal');
doc.setFontSize(15);
setText(BRAND);
doc.text('Guia prático, passo a passo', PW / 2, 163, { align: 'center' });

doc.setFontSize(11);
setText(MUTE);
const sub = doc.splitTextToSize(
  'Tudo o que você precisa para criar, preencher, editar e enviar o seu Diário com facilidade.',
  120
);
doc.text(sub, PW / 2, 178, { align: 'center' });

// texto no painel inferior
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
setText([255, 255, 255]);
doc.text('Diários de Obra', PW / 2, PH - 30, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
setText([210, 230, 222]);
doc.text('Documento de apoio aos usuários • Distribuição livre', PW / 2, PH - 22, { align: 'center' });

// página de conteúdo
onCover = false;
doc.addPage();
pageHeader();
y = 32;

/* ====================== SUMÁRIO ====================== */
h1('O que você vai encontrar');
paragraph(
  'Este guia foi feito em linguagem simples para que qualquer pessoa consiga usar o sistema sem dificuldades. ' +
  'Siga os passos na ordem e consulte as dúvidas frequentes sempre que precisar.'
);
[
  '1. Visão geral do sistema',
  '2. Criando um novo Diário (passo a passo)',
  '3. Tipos de Diário disponíveis',
  '4. Preenchendo as seções',
  '5. Salvando, editando e localizando Diários',
  '6. Gerando o PDF e enviando para assinatura',
  '7. Dicas e boas práticas',
  '8. Dúvidas frequentes',
  '9. Ajuda rápida dentro do sistema',
].forEach((t) => bullet(t));

/* ====================== 1. VISÃO GERAL ====================== */
h1('1. Visão geral do sistema');
paragraph(
  'O sistema permite registrar as atividades realizadas em obra de forma organizada. ' +
  'Cada registro é chamado de Diário e reúne informações como cliente, data, equipe, endereço, ' +
  'condições do tempo e os dados do ensaio realizado.'
);
paragraph(
  'Depois de preenchido, o Diário pode ser salvo, consultado a qualquer momento, exportado em PDF ' +
  'e enviado para o cliente assinar à distância.'
);
tip('Você não precisa decorar nada. O sistema mostra indicadores de seção concluída para ajudar a não esquecer nenhum campo.');

/* ====================== 2. CRIANDO ====================== */
h1('2. Criando um novo Diário');
h2('Passo a passo');
step(1, 'Abra um novo Diário', 'No menu principal, toque em "Novo Diário".');
step(2, 'Escolha o tipo de registro', 'Selecione o tipo desejado: PCE, PLACA, PIT, Ficha PDA ou PDA. O formulário se ajusta automaticamente ao tipo escolhido.');
step(3, 'Preencha os dados gerais', 'Informe o Cliente, a Data, os horários de Início e Término, a Equipe responsável e o Endereço da obra.');
step(4, 'Marque as condições climáticas', 'Escolha entre Ensolarado, Chuva fraca ou Chuva forte. Você pode marcar mais de uma opção.');
step(5, 'Complete o formulário do ensaio', 'Preencha os campos específicos do tipo escolhido (equipamentos, estacas ou pontos, ocorrências e abastecimento, quando houver).');
step(6, 'Salve o Diário', 'Revise as informações e toque em "Salvar". Pronto: o registro aparece na lista de Diários.');
tip('No celular, cada seção abre em uma tela própria. Toque no item, preencha e use "Concluir" para voltar ao fluxo.');

/* ====================== 3. TIPOS ====================== */
h1('3. Tipos de Diário disponíveis');
paragraph('Ao criar um Diário você escolhe um destes tipos. Cada um tem um formulário próprio:');
bullet('PCE — Prova de Carga Estática: equipamentos, estacas, carregamento e abastecimento.');
bullet('PLACA — Prova de Carga sobre Placa: pontos de ensaio e equipamentos.');
bullet('PIT — Ensaio de Integridade: equipamento, estacas e total de estacas.');
bullet('Ficha PDA — Ficha técnica detalhada do ensaio dinâmico (PDA).');
bullet('PDA — Diário do dia para ensaios PDA, com estacas e abastecimento.');
tip('Escolheu o tipo errado? Use a opção "Alterar tipo" no topo do fluxo para trocar antes de salvar.');

/* ====================== 4. SEÇÕES ====================== */
h1('4. Preenchendo as seções');
h2('Dados gerais');
bullet('Cliente: selecione na lista de clientes cadastrados.');
bullet('Data, Início e Término: use o calendário e os horários no formato 00:00.');
bullet('Equipe: marque os integrantes que participaram do trabalho.');
h2('Endereço');
paragraph('Preencha Estado, Cidade, Rua e Número. A cidade pode ser escolhida na lista OU digitada no campo livre — basta uma das duas formas.');
h2('Condições climáticas');
paragraph('Marque como estava o tempo no dia do serviço. Essa informação aparece no PDF final.');
h2('Estacas e pontos');
paragraph('Nos formulários que pedem estacas ou pontos de ensaio, use o botão de adicionar para incluir quantos itens forem necessários. Cada item pode ser expandido para preencher os detalhes.');
h2('Assinaturas');
paragraph('As assinaturas são feitas fora do sistema (GOV.BR). O PDF gerado traz os espaços em branco para a Geoteste e o cliente assinarem depois.');

/* ====================== 5. EDITAR/LOCALIZAR ====================== */
h1('5. Salvando, editando e localizando');
bullet('Após salvar, o Diário fica disponível na lista de Diários.');
bullet('Use a busca e os filtros por data, cliente e tipo para localizar rapidamente.');
bullet('Toque em um Diário para visualizar todos os detalhes.');
tip('Confira sempre os dados antes de salvar. É a forma mais rápida de garantir um Diário completo e correto.');

/* ====================== 6. PDF / ASSINATURA ====================== */
h1('6. Gerando o PDF e enviando para assinatura');
h2('Exportar PDF');
paragraph('Abra o Diário na lista e toque em "Exportar PDF" para baixar o documento pronto para impressão ou envio. Também é possível exportar em CSV (Excel).');
h2('Link de assinatura');
paragraph(
  'Toque em "Link Assinatura" para gerar um endereço público. Copie e envie ao cliente: ' +
  'ele consegue assinar o Diário pelo navegador, sem precisar de acesso ao sistema.'
);
tip('O link é gerado na hora. Use o botão "Copiar" para compartilhar por mensagem ou e-mail com poucos toques.');

/* ====================== 7. BOAS PRÁTICAS ====================== */
h1('7. Dicas e boas práticas');
bullet('Preencha as seções na ordem em que aparecem.');
bullet('Use os indicadores de "seção concluída" como checklist.');
bullet('Confira datas e horários antes de salvar.');
bullet('Cadastre os clientes antes de criar o Diário para selecioná-los na lista.');
bullet('Adicione todas as estacas/pontos do dia para que o PDF fique completo.');
bullet('Gere o link de assinatura assim que o Diário estiver pronto.');

/* ====================== 8. FAQ ====================== */
h1('8. Dúvidas frequentes');
faq('Os campos com * são obrigatórios?', 'Sim. Cliente, Data, horários, Equipe e Endereço completo precisam estar preenchidos para salvar.');
faq('A cidade não aparece na lista. E agora?', 'Você pode selecionar na lista ou digitar a cidade no campo livre. Uma das duas formas já é suficiente.');
faq('Como preencho as assinaturas?', 'As assinaturas são feitas fora do sistema (GOV.BR). O PDF traz os espaços em branco e você pode gerar um link para o cliente assinar pelo navegador.');
faq('Posso adicionar mais de uma estaca ou ponto?', 'Sim. Dentro do formulário do tipo escolhido, use o botão de adicionar para incluir quantos itens precisar.');
faq('Onde encontro um Diário já criado?', 'Na lista de Diários, com busca e filtros por data, cliente e tipo.');
faq('Escolhi o tipo errado de Diário?', 'Use "Alterar tipo" no topo do fluxo para trocar antes de salvar.');

/* ====================== 9. AJUDA RÁPIDA ====================== */
h1('9. Ajuda rápida dentro do sistema');
paragraph(
  'Sempre que tiver uma dúvida durante o uso, toque no botão "Dúvidas sobre o Diário" ' +
  '(ícone de interrogação) no canto inferior direito da tela.'
);
paragraph(
  'Ele abre um painel com o passo a passo resumido e as dúvidas mais comuns — ' +
  'um atalho de consulta rápida sem sair do que você está fazendo.'
);
tip('Guarde este manual em PDF e use o botão de ajuda no sistema para consultas rápidas no dia a dia.');

footer();
const buf = Buffer.from(doc.output('arraybuffer'));
writeFileSync(OUT, buf);
console.log('PDF gerado em:', OUT, '(' + buf.length + ' bytes)');
