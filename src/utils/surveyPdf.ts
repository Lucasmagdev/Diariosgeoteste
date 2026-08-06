import jsPDF from 'jspdf';

const BRAND: [number, number, number] = [21, 107, 79];
const BRAND_DARK: [number, number, number] = [13, 74, 54];
const SOFT: [number, number, number] = [233, 244, 239];
const INK: [number, number, number] = [31, 41, 51];
const BODY: [number, number, number] = [55, 65, 75];
const MUTE: [number, number, number] = [120, 130, 138];
const LINE: [number, number, number] = [205, 216, 211];
const TABLE_ALT: [number, number, number] = [244, 248, 246];
const WHITE: [number, number, number] = [255, 255, 255];

export interface SurveyPdfData {
  obraName?: string | null;
  empresa?: string | null;
  dataReferencia?: string | null;
  createdAt: string;
  ratings: { label: string; value: number }[];
  avaliacaoGeral: number;
  nps: number;
  comentarioAgradou?: string | null;
  comentarioMelhorar?: string | null;
  comentarioObservacao?: string | null;
}

const txt = (v: any): string => (v === null || v === undefined ? '' : String(v).trim());
const orNI = (v: any): string => txt(v) || 'Não informado';

/**
 * Datas puras (YYYY-MM-DD, vindas do input date) precisam ser formatadas sem
 * passar por new Date(): o parse trataria como UTC e, em fuso negativo, o PDF
 * sairia com o dia anterior ao que o cliente respondeu.
 */
const formatDateOnlyBR = (value: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
};

async function loadImage(url?: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
      img.onerror = () => resolve(1);
      img.src = dataUrl;
    });
    return { dataUrl, ratio };
  } catch {
    return null;
  }
}

async function buildSurveyDoc(data: SurveyPdfData): Promise<jsPDF> {
  const { obraName, empresa, dataReferencia, createdAt, ratings, avaliacaoGeral, nps, comentarioAgradou, comentarioMelhorar, comentarioObservacao } = data;
  const logo = await loadImage('/logogeoteste.png');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MX = 14;
  const CW = PW - MX * 2;
  const BOTTOM = PH - 16;
  let y = 0;

  const setFill = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

  const emittedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const drawHeader = () => {
    if (logo) {
      const h = 14;
      doc.addImage(logo.dataUrl, 'PNG', MX, 11, h * logo.ratio, h, 'logo', 'FAST');
    }
    const tx = MX + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setText(INK);
    doc.text('PESQUISA DE SATISFAÇÃO', tx, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(BRAND);
    doc.text('Geoteste Ensaios Geotécnicos', tx, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text('RESPONDIDO EM', PW - MX, 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(INK);
    doc.text(createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : '-', PW - MX, 18.5, { align: 'right' });

    setDraw(BRAND);
    doc.setLineWidth(0.5);
    doc.line(MX, 29, PW - MX, 29);

    setFill(SOFT);
    doc.rect(MX, 31, CW, 11, 'F');
    setFill(BRAND);
    doc.rect(MX, 31, 1.6, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(MUTE);
    doc.text('EMPRESA', MX + 4, 35);
    doc.text('OBRA', MX + CW * 0.42, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(BRAND_DARK);
    doc.text(doc.splitTextToSize(orNI(empresa), CW * 0.4 - 4)[0] || '-', MX + 4, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(BODY);
    doc.text(doc.splitTextToSize(orNI(obraName), CW * 0.56)[0] || '-', MX + CW * 0.42, 40);

    y = 47;
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();
    const total = (doc as any).internal.pages.length - 1;
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.line(MX, PH - 12, PW - MX, PH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(MUTE);
    doc.text('Geoteste • Pesquisa de Satisfação', MX, PH - 8);
    doc.text(`Página ${page} de ${total} • emitido ${emittedAt}`, PW - MX, PH - 8, { align: 'right' });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage('a4');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(BRAND_DARK);
    doc.text('PESQUISA DE SATISFAÇÃO', MX, 16);
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.line(MX, 19, PW - MX, 19);
    y = 24;
  };

  const ensure = (space: number) => { if (y + space > BOTTOM) newPage(); };

  const sectionTitle = (label: string) => {
    ensure(9);
    setFill(BRAND);
    doc.roundedRect(MX, y, CW, 5.6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(WHITE);
    doc.text(label.toUpperCase(), MX + 2.5, y + 3.9);
    y += 7.5;
  };

  drawHeader();

  if (dataReferencia) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text(`Data informada na pesquisa: ${formatDateOnlyBR(dataReferencia)}`, MX, y);
    y += 6;
  }

  sectionTitle('Avaliações');
  const headerH = 7;
  const widths = [6, 1.4];
  const totalW = CW;
  const w = widths.map((x) => (x / widths.reduce((a, b) => a + b, 0)) * totalW);
  ensure(headerH + 8);
  setFill(BRAND_DARK);
  doc.rect(MX, y, totalW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(WHITE);
  doc.text('Item', MX + 3, y + headerH / 2 + 1.5);
  doc.text('Nota', MX + w[0] + w[1] / 2, y + headerH / 2 + 1.5, { align: 'center' });
  y += headerH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  ratings.forEach((r, idx) => {
    const cellLines = doc.splitTextToSize(r.label, w[0] - 5);
    const rowH = Math.max(6.5, 3 + cellLines.length * 3.4);
    if (y + rowH > BOTTOM) { newPage(); }
    if (idx % 2 === 1) { setFill(TABLE_ALT); doc.rect(MX, y, totalW, rowH, 'F'); }
    setText(BODY);
    doc.text(cellLines, MX + 3, y + 4.2);
    doc.setFont('helvetica', 'bold');
    setText(BRAND_DARK);
    doc.text(String(r.value), MX + w[0] + w[1] / 2, y + rowH / 2 + 1.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    setDraw(LINE);
    doc.setLineWidth(0.15);
    doc.line(MX, y + rowH, MX + totalW, y + rowH);
    y += rowH;
  });
  y += 3;

  sectionTitle('Avaliação geral e recomendação');
  ensure(14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(BODY);
  doc.text(`Avaliação geral: ${avaliacaoGeral} / 5`, MX + 2, y + 5);
  doc.text(`Probabilidade de recomendar (NPS): ${nps} / 10`, MX + 2, y + 11);
  y += 16;

  const comment = (label: string, value?: string | null) => {
    sectionTitle(label);
    const lines = doc.splitTextToSize(txt(value) || '—', CW - 4);
    const h = Math.max(7, lines.length * 4.2 + 3);
    ensure(h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(BODY);
    doc.text(lines, MX + 2, y + 4);
    y += h;
  };

  comment('O que mais agradou', comentarioAgradou);
  comment('Pontos de melhoria', comentarioMelhorar);
  comment('Elogios, sugestões ou observações', comentarioObservacao);

  drawFooter();
  return doc;
}

export async function generateSurveyPdf(data: SurveyPdfData, fileName: string): Promise<void> {
  const doc = await buildSurveyDoc(data);
  doc.save(fileName);
}
