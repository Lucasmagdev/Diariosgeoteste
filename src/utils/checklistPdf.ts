import jsPDF from 'jspdf';

/**
 * Gerador VETORIAL do PDF de Checklist de Obra.
 * Mesma linha visual do diaryPdf.ts (cabeçalho, faixa cliente/obra, rodapé).
 */

const BRAND: [number, number, number] = [21, 107, 79];
const BRAND_DARK: [number, number, number] = [13, 74, 54];
const SOFT: [number, number, number] = [233, 244, 239];
const INK: [number, number, number] = [31, 41, 51];
const BODY: [number, number, number] = [55, 65, 75];
const MUTE: [number, number, number] = [120, 130, 138];
const LINE: [number, number, number] = [205, 216, 211];
const TABLE_ALT: [number, number, number] = [244, 248, 246];
const WHITE: [number, number, number] = [255, 255, 255];

export interface ChecklistPdfItem {
  text: string;
  required: boolean;
  requiresPhoto: boolean;
  checked: boolean;
  photoData?: string | null;
  note?: string | null;
}

export interface ChecklistPdfData {
  obraName: string;
  clientName: string;
  title: string;
  status: 'pending' | 'completed';
  createdAt?: string | null;
  signedBy?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
  items: ChecklistPdfItem[];
}

interface LoadedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  ratio: number;
}

async function loadImage(url?: string | null): Promise<LoadedImage | null> {
  if (!url) return null;
  try {
    let dataUrl = url;
    if (!url.startsWith('data:')) {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
      img.onerror = () => resolve(1);
      img.src = dataUrl;
    });
    const format: 'PNG' | 'JPEG' = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, format, ratio };
  } catch {
    return null;
  }
}

const txt = (v: any): string => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};
const orNI = (v: any): string => txt(v) || 'Não informado';

const formatDateTimeBR = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
};

async function buildChecklistDoc(data: ChecklistPdfData): Promise<jsPDF> {
  const { obraName, clientName, title, status, createdAt, signedBy, signedAt, signatureUrl, items } = data;

  const logo = await loadImage('/logogeoteste.png');
  const sigImg = await loadImage(signatureUrl);

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
      doc.addImage(logo.dataUrl, logo.format, MX, 11, h * logo.ratio, h, 'logo', 'FAST');
    }
    const tx = MX + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setText(INK);
    doc.text('CHECKLIST DE OBRA', tx, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(BRAND);
    doc.text(orNI(title), tx, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text('CRIADO EM', PW - MX, 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(INK);
    doc.text(createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : '-', PW - MX, 18.5, { align: 'right' });

    const done = status === 'completed';
    const stTxt = done ? 'Concluído' : 'Pendente';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const stW = doc.getTextWidth(stTxt) + 7;
    setFill(done ? BRAND : [148, 120, 20]);
    doc.roundedRect(PW - MX - stW, 21, stW, 5.2, 1.2, 1.2, 'F');
    setText(WHITE);
    doc.text(stTxt, PW - MX - stW / 2, 24.6, { align: 'center' });

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
    doc.text('CLIENTE', MX + 4, 35);
    doc.text('OBRA', MX + CW * 0.42, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(BRAND_DARK);
    doc.text(doc.splitTextToSize(orNI(clientName), CW * 0.4 - 4)[0] || '-', MX + 4, 40);
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
    doc.text('Geoteste • Checklist de Obra', MX, PH - 8);
    doc.text(`Página ${page} de ${total} • emitido ${emittedAt}`, PW - MX, PH - 8, { align: 'right' });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage('a4');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(BRAND_DARK);
    doc.text('CHECKLIST DE OBRA', MX, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text(`${orNI(clientName)} • ${orNI(obraName)}`, PW - MX, 16, { align: 'right' });
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.line(MX, 19, PW - MX, 19);
    y = 24;
  };

  const ensure = (space: number) => {
    if (y + space > BOTTOM) newPage();
  };

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

  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const totalW = CW;
    const w = widths.map((x) => (x / widths.reduce((a, b) => a + b, 0)) * totalW);

    const headerH = 7;
    const drawHead = () => {
      ensure(headerH + 8);
      setFill(BRAND_DARK);
      doc.rect(MX, y, totalW, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(WHITE);
      let cx = MX;
      headers.forEach((h, idx) => {
        doc.text(h, cx + w[idx] / 2, y + headerH / 2 + 1.5, { align: 'center' });
        cx += w[idx];
      });
      y += headerH;
    };

    drawHead();

    if (rows.length === 0) {
      ensure(7);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      setText(MUTE);
      doc.text('Sem itens', MX + totalW / 2, y + 5, { align: 'center' });
      setDraw(LINE);
      doc.setLineWidth(0.2);
      doc.rect(MX, y, totalW, 7.5);
      y += 9;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    rows.forEach((row, ridx) => {
      const cellLines = row.map((c, idx) => doc.splitTextToSize(c || '-', w[idx] - 3));
      const rowH = Math.max(6.5, ...cellLines.map((l) => 3 + l.length * 3.4));
      if (y + rowH > BOTTOM) {
        newPage();
        drawHead();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }
      if (ridx % 2 === 1) {
        setFill(TABLE_ALT);
        doc.rect(MX, y, totalW, rowH, 'F');
      }
      let cx = MX;
      cellLines.forEach((lines, idx) => {
        setText(BODY);
        const align = idx === 0 ? 'left' : 'center';
        doc.text(lines, align === 'left' ? cx + 2 : cx + w[idx] / 2, y + 4.2, { align });
        cx += w[idx];
      });
      setDraw(LINE);
      doc.setLineWidth(0.15);
      doc.line(MX, y + rowH, MX + totalW, y + rowH);
      y += rowH;
    });
    setDraw(LINE);
    doc.setLineWidth(0.25);
    doc.line(MX, y, MX + totalW, y);
    y += 3;
  };

  // ============================================================ render
  drawHeader();

  sectionTitle('Itens do checklist');
  table(
    ['Item', 'Obrigatório', 'Foto', 'Marcado', 'Observação'],
    items.map((it) => [
      it.text,
      it.required ? 'Sim' : 'Não',
      it.requiresPhoto ? 'Sim' : 'Não',
      it.checked ? 'OK' : 'Pendente',
      txt(it.note) || '-',
    ]),
    [4, 1.3, 1, 1.2, 2.5],
  );

  const withPhotos = items.filter((it) => it.photoData);
  if (withPhotos.length > 0) {
    sectionTitle('Fotos anexadas');
    const cols = 2;
    const gap = 4;
    const photoW = (CW - gap * (cols - 1)) / cols;
    const photoH = 40;
    let cx = MX;
    let rowStartY = y;
    withPhotos.forEach((it, idx) => {
      const col = idx % cols;
      if (col === 0) {
        ensure(photoH + 8);
        rowStartY = y;
        cx = MX;
      }
      try {
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, rowStartY, photoW, photoH, 1.5, 1.5, 'S');
        doc.addImage(it.photoData as string, cx + 1, rowStartY + 1, photoW - 2, photoH - 2, undefined, 'FAST');
      } catch { /* ignora imagem inválida */ }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      setText(MUTE);
      const label = doc.splitTextToSize(it.text, photoW)[0] || '';
      doc.text(label, cx + 1, rowStartY + photoH + 3);
      cx += photoW + gap;
      if (col === cols - 1 || idx === withPhotos.length - 1) {
        y = rowStartY + photoH + 6;
      }
    });
  }

  const blockH = 36;
  ensure(blockH + 2);
  sectionTitle('Assinatura');
  const boxW = CW;
  const boxH = 30;
  setDraw(LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(MX, y, boxW, boxH, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  setText(MUTE);
  doc.text('ASSINADO POR', MX + 3, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(INK);
  doc.text(orNI(signedBy), MX + 3, y + 9);
  const areaY = y + 11;
  const areaH = 14;
  if (sigImg) {
    const h = Math.min(areaH, (boxW - 12) / sigImg.ratio);
    try {
      doc.addImage(sigImg.dataUrl, sigImg.format, MX + 3, areaY + (areaH - h) / 2, h * sigImg.ratio, h);
    } catch { /* ignora imagem inválida */ }
  } else {
    setDraw([150, 160, 155]);
    doc.setLineWidth(0.3);
    doc.line(MX + 4, areaY + areaH - 1, MX + boxW - 8, areaY + areaH - 1);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(MUTE);
  doc.text(`Assinado em: ${formatDateTimeBR(signedAt)}`, MX + 3, y + boxH - 2.5);
  y += boxH + 2;

  drawFooter();
  return doc;
}

/** Gera e baixa o PDF do checklist. */
export async function generateChecklistPdf(data: ChecklistPdfData, fileName: string): Promise<void> {
  const doc = await buildChecklistDoc(data);
  doc.save(fileName);
}

/** Gera o PDF e retorna uma URL de blob para visualização (iframe/embed). */
export async function checklistPdfBlobUrl(data: ChecklistPdfData): Promise<string> {
  const doc = await buildChecklistDoc(data);
  return doc.output('bloburl') as unknown as string;
}
