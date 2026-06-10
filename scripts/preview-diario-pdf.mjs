// Preview do PDF do Diário (espelha src/utils/diaryPdf.ts) com dados de exemplo.
// Uso: node scripts/preview-diario-pdf.mjs
import { jsPDF } from 'jspdf';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tutoriais', 'exemplo-diario.pdf');
const LOGO = readFileSync(join(__dirname, '..', 'public', 'logogeoteste.png')).toString('base64');

// ---- dados de exemplo (PCE convencional)
const diary = {
  id: 'a1b2c3d4-0000',
  clientName: 'DIRECIONAL 752',
  address: 'Rua Abreu Guimarães, 324, Ouro Preto, Minas Gerais',
  team: 'João Silva, Carlos Souza, Pedro Lima',
  date: '2026-06-09',
  startTime: '07:00',
  endTime: '17:00',
  geotestSignature: 'Eng. Marcos Andrade',
  geotestCpf: '12345678901',
  responsibleSignedBy: '',
  responsibleCpf: '',
  signatureStatus: 'pending',
  observations: '',
  weather_ensolarado: true,
  weather_chuva_fraca: false,
  weather_chuva_forte: false,
};
const pceDetail = {
  ensaio_tipo: 'PCE CONVENCIONAL',
  carregamento_tipos: ['Lento', 'Rápido'],
  equipamentos_macaco: 'M-200',
  equipamentos_celula: 'CC-50',
  equipamentos_manometro: 'MN-12',
  equipamentos_relogios: '4 relógios',
  equipamentos_conjunto_vigas: 'Conjunto de vigas metálicas perfil W',
  cravacao_equipamento: 'PCE',
  ocorrencias: '',
};
const pcePiles = [
  { estaca_nome: 'E-01', estaca_tipo: 'Hélice', estaca_profundidade_m: '20,00', estaca_carga_trabalho_tf: '', estaca_diametro_cm: '40' },
  { estaca_nome: 'E-02', estaca_tipo: 'Hélice', estaca_profundidade_m: '18,50', estaca_carga_trabalho_tf: '120', estaca_diametro_cm: '40' },
  { estaca_nome: 'E-03', estaca_tipo: 'Escavada', estaca_profundidade_m: '22,00', estaca_carga_trabalho_tf: '150', estaca_diametro_cm: '50' },
];

// ============ paleta
const BRAND = [21, 107, 79], BRAND_DARK = [13, 74, 54], SOFT = [233, 244, 239];
const INK = [31, 41, 51], BODY = [55, 65, 75], MUTE = [120, 130, 138];
const LINE = [205, 216, 211], TABLE_ALT = [244, 248, 246], WHITE = [255, 255, 255];

const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
const orNI = (v) => txt(v) || 'Não informado';
const formatTime24h = (v) => txt(v);
const formatCpf = (v) => {
  const d = (v || '').replace(/\D/g, '');
  if (d.length !== 11) return v || '';
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};
const formatDateBR = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
const PW = 210, PH = 297, MX = 14, CW = PW - MX * 2, BOTTOM = PH - 16;
let y = 0;
const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
const logoRatio = 1;
const subtitle = pceDetail.ensaio_tipo;
const emittedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const diaryRef = txt(diary.id).slice(0, 8).toUpperCase();

function drawHeader() {
  const h = 14;
  doc.addImage(LOGO, 'PNG', MX, 11, h * logoRatio, h, 'logo', 'FAST');
  const tx = MX + 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); setText(INK);
  doc.text('DIÁRIO DE OBRA', tx, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setText(BRAND);
  doc.text(subtitle, tx, 24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(MUTE);
  doc.text('DATA', PW - MX, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setText(INK);
  doc.text(formatDateBR(diary.date), PW - MX, 18.5, { align: 'right' });
  const signed = diary.signatureStatus === 'signed';
  const stTxt = signed ? 'Assinado' : 'Pendente';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  const stW = doc.getTextWidth(stTxt) + 7;
  setFill(signed ? BRAND : [148, 120, 20]);
  doc.roundedRect(PW - MX - stW, 21, stW, 5.2, 1.2, 1.2, 'F');
  setText(WHITE);
  doc.text(stTxt, PW - MX - stW / 2, 24.6, { align: 'center' });
  setDraw(BRAND); doc.setLineWidth(0.5); doc.line(MX, 29, PW - MX, 29);
  setFill(SOFT); doc.rect(MX, 31, CW, 11, 'F');
  setFill(BRAND); doc.rect(MX, 31, 1.6, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText(MUTE);
  doc.text('CLIENTE', MX + 4, 35);
  doc.text('OBRA / ENDEREÇO', MX + CW * 0.42, 35);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setText(BRAND_DARK);
  doc.text(doc.splitTextToSize(orNI(diary.clientName), CW * 0.4 - 4)[0] || '-', MX + 4, 40);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText(BODY);
  doc.text(doc.splitTextToSize(orNI(diary.address), CW * 0.56)[0] || '-', MX + CW * 0.42, 40);
  y = 47;
}

function drawFooter() {
  const page = doc.getNumberOfPages();
  const total = doc.internal.pages.length - 1;
  setDraw(LINE); doc.setLineWidth(0.3); doc.line(MX, PH - 12, PW - MX, PH - 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setText(MUTE);
  doc.text('Geoteste • Diário de Obra', MX, PH - 8);
  doc.text(`ID ${diaryRef}`, PW / 2, PH - 8, { align: 'center' });
  doc.text(`Página ${page} de ${total} • emitido ${emittedAt}`, PW - MX, PH - 8, { align: 'right' });
}
function newPage() {
  drawFooter(); doc.addPage('a4');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setText(BRAND_DARK);
  doc.text('DIÁRIO DE OBRA', MX, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(MUTE);
  doc.text(`${orNI(diary.clientName)} • ${formatDateBR(diary.date)}`, PW - MX, 16, { align: 'right' });
  setDraw(LINE); doc.setLineWidth(0.3); doc.line(MX, 19, PW - MX, 19);
  y = 24;
}
const ensure = (s) => { if (y + s > BOTTOM) newPage(); };

function sectionTitle(label) {
  ensure(9);
  setFill(BRAND); doc.roundedRect(MX, y, CW, 5.6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(WHITE);
  doc.text(label.toUpperCase(), MX + 2.5, y + 3.9);
  y += 7.5;
}

function fieldsGrid(items, cols) {
  const colW = CW / cols;
  let i = 0;
  while (i < items.length) {
    const row = []; let used = 0;
    while (i < items.length) {
      const sp = Math.min(items[i].span || 1, cols);
      if (used + sp > cols) break;
      row.push({ ...items[i], span: sp }); used += sp; i++;
    }
    const measured = row.map((f) => {
      const w = colW * (f.span || 1) - 3;
      if (f.draw) return { f, w, lines: [], h: 11 };
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(f.value || 'Não informado', w);
      return { f, w, lines, h: 4 + lines.length * 3.6 + 2.5 };
    });
    const rowH = Math.max(9, ...measured.map((m) => m.h));
    ensure(rowH + 1);
    let cx = MX;
    for (const m of measured) {
      const w = colW * (m.f.span || 1);
      if (m.f.draw) { m.f.draw(cx + 1.5, y, w - 3); }
      else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); setText(MUTE);
        doc.text(m.f.label.toUpperCase(), cx + 1.5, y + 3.2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText(BODY);
        doc.text(m.lines, cx + 1.5, y + 7);
      }
      cx += w;
    }
    setDraw(LINE); doc.setLineWidth(0.2); doc.line(MX, y + rowH, MX + CW, y + rowH);
    y += rowH + 1.5;
  }
  y += 1.5;
}

function drawCheck(x, cy, checked, label) {
  const s = 2.6;
  setDraw([90, 100, 95]); doc.setLineWidth(0.3);
  doc.rect(x, cy - s + 0.4, s, s);
  if (checked) { setFill(BRAND); doc.rect(x + 0.5, cy - s + 0.9, s - 1, s - 1, 'F'); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText(BODY);
  doc.text(label, x + s + 1.5, cy);
  return doc.getTextWidth(label) + s + 6;
}
const climateField = () => ({
  label: 'Clima', span: 5,
  draw: (x, yTop) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); setText(MUTE);
    doc.text('CLIMA', x, yTop + 3.2);
    const e = !!diary.weather_ensolarado, cf = !!diary.weather_chuva_fraca, cF = !!diary.weather_chuva_forte;
    const none = !e && !cf && !cF;
    let cx = x; const cy = yTop + 8;
    cx += drawCheck(cx, cy, e, 'Ensolarado');
    cx += drawCheck(cx, cy, cf, 'Chuva fraca');
    cx += drawCheck(cx, cy, cF, 'Chuva forte');
    drawCheck(cx, cy, none, 'Não informado');
    return 11;
  },
});

function table(headers, rows, widths) {
  const totalW = CW;
  const w = widths ? widths.map((x) => (x / widths.reduce((a, b) => a + b, 0)) * totalW) : headers.map(() => totalW / headers.length);
  const headerH = 7;
  const drawHead = () => {
    ensure(headerH + 8);
    setFill(BRAND_DARK); doc.rect(MX, y, totalW, headerH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText(WHITE);
    let cx = MX;
    headers.forEach((h, idx) => {
      const lines = doc.splitTextToSize(h, w[idx] - 2);
      doc.text(lines, cx + w[idx] / 2, y + headerH / 2 - (lines.length - 1) * 1.3 + 1, { align: 'center' });
      cx += w[idx];
    });
    y += headerH;
  };
  drawHead();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  rows.forEach((row, ridx) => {
    const cellLines = row.map((c, idx) => doc.splitTextToSize(c || 'Não informado', w[idx] - 3));
    const rowH = Math.max(6.5, ...cellLines.map((l) => 3 + l.length * 3.4));
    if (y + rowH > BOTTOM) { newPage(); drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); }
    if (ridx % 2 === 1) { setFill(TABLE_ALT); doc.rect(MX, y, totalW, rowH, 'F'); }
    let cx = MX;
    cellLines.forEach((lines, idx) => { setText(BODY); doc.text(lines, cx + w[idx] / 2, y + 4.2, { align: 'center' }); cx += w[idx]; });
    setDraw(LINE); doc.setLineWidth(0.15); doc.line(MX, y + rowH, MX + totalW, y + rowH);
    y += rowH;
  });
  setDraw(LINE); doc.setLineWidth(0.25); doc.line(MX, y, MX + totalW, y);
  y += 3;
}

function occurrences(value) {
  sectionTitle('Ocorrências');
  const v = txt(value) || 'Sem ocorrências registradas';
  doc.setFont('helvetica', txt(value) ? 'normal' : 'italic'); doc.setFontSize(8.5);
  setText(txt(value) ? BODY : MUTE);
  const lines = doc.splitTextToSize(v, CW - 4);
  ensure(lines.length * 4 + 3);
  doc.text(lines, MX + 2, y + 3.5);
  y += lines.length * 4 + 4;
}

function signatures() {
  ensure(38);
  sectionTitle('Assinaturas');
  const colW = CW / 2, boxH = 30;
  const drawSig = (x, who, name, cpf, emptyLine) => {
    setDraw(LINE); doc.setLineWidth(0.3); doc.roundedRect(x, y, colW - 3, boxH, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); setText(MUTE);
    doc.text(who.toUpperCase(), x + 3, y + 4.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(INK);
    doc.text(name || '-', x + 3, y + 9);
    const areaY = y + 11, areaH = 12;
    if (emptyLine) { setDraw([150, 160, 155]); doc.setLineWidth(0.3); doc.line(x + 4, areaY + areaH - 1, x + colW - 8, areaY + areaH - 1); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText(MUTE);
    doc.text(`CPF: ${cpf || '—'}`, x + 3, y + boxH - 2.5);
  };
  drawSig(MX, 'Responsável Geoteste', txt(diary.geotestSignature), formatCpf(diary.geotestCpf), false);
  drawSig(MX + colW, 'Cliente', '', formatCpf(diary.responsibleCpf), true);
  y += boxH + 2;
}

// ===== render PCE
drawHeader();
sectionTitle('Identificação');
fieldsGrid([
  { label: 'Equipamento', value: orNI(pceDetail.cravacao_equipamento || 'PCE') },
  { label: 'Início', value: formatTime24h(diary.startTime) || '-' },
  { label: 'Término', value: formatTime24h(diary.endTime) || '-' },
  { label: 'Equipe', value: orNI(diary.team), span: 2 },
  climateField(),
], 5);
sectionTitle('Dados do ensaio');
fieldsGrid([
  { label: 'Tipo', value: orNI(pceDetail.ensaio_tipo), span: 2 },
  { label: 'Carregamento', value: pceDetail.carregamento_tipos.join(', '), span: 2 },
  { label: 'Macaco', value: orNI(pceDetail.equipamentos_macaco) },
  { label: 'Célula', value: orNI(pceDetail.equipamentos_celula) },
  { label: 'Manômetro', value: orNI(pceDetail.equipamentos_manometro) },
  { label: 'Relógios', value: orNI(pceDetail.equipamentos_relogios) },
  { label: 'Vigas', value: orNI(pceDetail.equipamentos_conjunto_vigas), span: 4 },
], 4);
sectionTitle('Estacas');
table(
  ['Estaca', 'Tipo', 'Prof. (m)', 'Carga (tf)', 'Diâm. (cm)'],
  pcePiles.map((p) => [orNI(p.estaca_nome), orNI(p.estaca_tipo), orNI(p.estaca_profundidade_m), orNI(p.estaca_carga_trabalho_tf), orNI(p.estaca_diametro_cm)]),
  [1, 0.9, 1.3, 1, 1],
);
occurrences(pceDetail.ocorrencias || diary.observations);
signatures();
drawFooter();

writeFileSync(OUT, Buffer.from(doc.output('arraybuffer')));
console.log('PDF de exemplo gerado em:', OUT);
