import jsPDF from 'jspdf';
import { formatTime24h } from './time';

/**
 * Gerador VETORIAL do PDF do Diário de Obra.
 * Produz texto real (pesquisável/selecionável), tabelas e cabeçalho desenhados
 * diretamente no PDF — apenas logo e assinaturas são imagens.
 * Mantém o conteúdo em uma única página A4 sempre que possível.
 */

// ---------------------------------------------------------------- paleta
const BRAND: [number, number, number] = [21, 107, 79];
const BRAND_DARK: [number, number, number] = [13, 74, 54];
const SOFT: [number, number, number] = [233, 244, 239];
const INK: [number, number, number] = [31, 41, 51];
const BODY: [number, number, number] = [55, 65, 75];
const MUTE: [number, number, number] = [120, 130, 138];
const LINE: [number, number, number] = [205, 216, 211];
const TABLE_ALT: [number, number, number] = [244, 248, 246];
const WHITE: [number, number, number] = [255, 255, 255];

// ---------------------------------------------------------------- tipos
type DiaryAny = any;

export interface DiaryPdfData {
  diary: DiaryAny;
  pceDetail?: DiaryAny;
  pcePiles?: DiaryAny[];
  pitDetail?: DiaryAny;
  pitPiles?: DiaryAny[];
  placaDetail?: DiaryAny;
  placaPiles?: DiaryAny[];
  fichapdaDetail?: DiaryAny;
  pdaDiarioDetail?: DiaryAny;
  pdaDiarioPiles?: DiaryAny[];
}

interface LoadedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  ratio: number; // largura / altura
}

// ---------------------------------------------------------------- imagens
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

// ---------------------------------------------------------------- helpers de valor
const txt = (v: any): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s;
};
const orNI = (v: any): string => txt(v) || 'Não informado';

const formatCpf = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return raw;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatDateBR = (value?: string) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
};

// ---------------------------------------------------------------- principal
async function buildDiaryDoc(data: DiaryPdfData): Promise<jsPDF> {
  const {
    diary,
    pceDetail,
    pcePiles = [],
    pitDetail,
    pitPiles = [],
    placaDetail,
    placaPiles = [],
    fichapdaDetail,
    pdaDiarioDetail,
    pdaDiarioPiles = [],
  } = data;

  // Tipo e subtítulo
  let subtitle = 'Diário de obra';
  let kind: 'PCE' | 'PIT' | 'PLACA' | 'PDA' | 'GEN' = 'GEN';
  if (pceDetail) {
    kind = 'PCE';
    subtitle = txt(pceDetail.ensaio_tipo) || 'PCE';
  } else if (pitDetail) {
    kind = 'PIT';
    subtitle = 'Ensaio de integridade (PIT)';
  } else if (placaDetail) {
    kind = 'PLACA';
    subtitle = 'Prova de carga sobre placa';
  } else if (fichapdaDetail || pdaDiarioDetail) {
    kind = 'PDA';
    subtitle = 'Ensaio dinâmico (PDA)';
  }

  const logo = await loadImage('/logogeoteste.png');
  const geoSig = await loadImage(diary?.geotestSignatureImage);
  const cliSig = await loadImage(diary?.responsibleSignatureImage);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const PW = doc.internal.pageSize.getWidth();   // 210
  const PH = doc.internal.pageSize.getHeight();  // 297
  const MX = 14;
  const CW = PW - MX * 2;
  const BOTTOM = PH - 16;
  let y = 0;

  const setFill = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

  const emittedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const diaryRef = txt(diary?.id).slice(0, 8).toUpperCase();

  // ----- cabeçalho institucional
  const drawHeader = () => {
    if (logo) {
      const h = 14;
      doc.addImage(logo.dataUrl, logo.format, MX, 11, h * logo.ratio, h, 'logo', 'FAST');
    }
    const tx = MX + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setText(INK);
    doc.text('DIÁRIO DE OBRA', tx, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(BRAND);
    doc.text(subtitle, tx, 24);

    // cartão à direita: cliente / data / status
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text('DATA', PW - MX, 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(INK);
    doc.text(formatDateBR(diary?.date), PW - MX, 18.5, { align: 'right' });

    const signed = diary?.signatureStatus === 'signed';
    const stTxt = signed ? 'Assinado' : 'Pendente';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const stW = doc.getTextWidth(stTxt) + 7;
    setFill(signed ? BRAND : [148, 120, 20]);
    doc.roundedRect(PW - MX - stW, 21, stW, 5.2, 1.2, 1.2, 'F');
    setText(WHITE);
    doc.text(stTxt, PW - MX - stW / 2, 24.6, { align: 'center' });

    // divisor
    setDraw(BRAND);
    doc.setLineWidth(0.5);
    doc.line(MX, 29, PW - MX, 29);

    // faixa cliente / obra
    setFill(SOFT);
    doc.rect(MX, 31, CW, 11, 'F');
    setFill(BRAND);
    doc.rect(MX, 31, 1.6, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(MUTE);
    doc.text('CLIENTE', MX + 4, 35);
    doc.text('OBRA / ENDEREÇO', MX + CW * 0.42, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(BRAND_DARK);
    doc.text(doc.splitTextToSize(orNI(diary?.clientName), CW * 0.4 - 4)[0] || '-', MX + 4, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(BODY);
    const addr = doc.splitTextToSize(orNI(diary?.address), CW * 0.56)[0] || '-';
    doc.text(addr, MX + CW * 0.42, 40);

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
    doc.text('Geoteste • Diário de Obra', MX, PH - 8);
    if (diaryRef) doc.text(`ID ${diaryRef}`, PW / 2, PH - 8, { align: 'center' });
    doc.text(`Página ${page} de ${total} • emitido ${emittedAt}`, PW - MX, PH - 8, { align: 'right' });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage('a4');
    // cabeçalho reduzido em páginas seguintes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(BRAND_DARK);
    doc.text('DIÁRIO DE OBRA', MX, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(MUTE);
    doc.text(`${orNI(diary?.clientName)} • ${formatDateBR(diary?.date)}`, PW - MX, 16, { align: 'right' });
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.line(MX, 19, PW - MX, 19);
    y = 24;
  };

  const ensure = (space: number) => {
    if (y + space > BOTTOM) newPage();
  };

  // ----- título de seção
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

  // ----- campos em grade
  type Field = {
    label: string;
    value?: string;
    span?: number;
    draw?: (x: number, yTop: number, w: number) => number; // retorna altura usada
  };

  const fieldsGrid = (items: Field[], cols: number) => {
    const colW = CW / cols;
    let i = 0;
    while (i < items.length) {
      // monta a linha
      const row: Field[] = [];
      let used = 0;
      while (i < items.length) {
        const sp = Math.min(items[i].span || 1, cols);
        if (used + sp > cols) break;
        row.push({ ...items[i], span: sp });
        used += sp;
        i++;
      }
      // mede altura da linha
      let rowH = 9;
      const measured = row.map((f) => {
        const w = colW * (f.span || 1) - 3;
        if (f.draw) {
          // estima via execução fora de tela impossível; usa altura fixa custom
          return { f, w, lines: [] as string[], h: 11 };
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const lines = doc.splitTextToSize(f.value || 'Não informado', w);
        const h = 4 + lines.length * 3.6 + 2.5;
        return { f, w, lines, h };
      });
      rowH = Math.max(9, ...measured.map((m) => m.h));
      ensure(rowH + 1);

      let cx = MX;
      for (const m of measured) {
        const w = colW * (m.f.span || 1);
        if (m.f.draw) {
          m.f.draw(cx + 1.5, y, w - 3);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          setText(MUTE);
          doc.text(m.f.label.toUpperCase(), cx + 1.5, y + 3.2);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          setText(BODY);
          doc.text(m.lines, cx + 1.5, y + 7);
        }
        cx += w;
      }
      // linha divisória sutil
      setDraw(LINE);
      doc.setLineWidth(0.2);
      doc.line(MX, y + rowH, MX + CW, y + rowH);
      y += rowH + 1.5;
    }
    y += 1.5;
  };

  // ----- checkbox desenhada
  const drawCheck = (x: number, cy: number, checked: boolean, label: string) => {
    const s = 2.6;
    setDraw([90, 100, 95]);
    doc.setLineWidth(0.3);
    doc.rect(x, cy - s + 0.4, s, s);
    if (checked) {
      setFill(BRAND);
      doc.rect(x + 0.5, cy - s + 0.9, s - 1, s - 1, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(BODY);
    doc.text(label, x + s + 1.5, cy);
    return doc.getTextWidth(label) + s + 6;
  };

  // ----- clima
  const climateField = (): Field => ({
    label: 'Clima',
    span: 5, // linha inteira: comporta as 4 opções
    draw: (x, yTop) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(MUTE);
      doc.text('CLIMA', x, yTop + 3.2);
      const e = !!diary?.weather_ensolarado;
      const cf = !!diary?.weather_chuva_fraca;
      const cF = !!diary?.weather_chuva_forte;
      const none = !e && !cf && !cF;
      let cx = x;
      const cy = yTop + 8;
      cx += drawCheck(cx, cy, e, 'Ensolarado');
      cx += drawCheck(cx, cy, cf, 'Chuva fraca');
      cx += drawCheck(cx, cy, cF, 'Chuva forte');
      drawCheck(cx, cy, none, 'Não informado');
      return 11;
    },
  });

  // ----- diesel sim/não
  const dieselField = (val: boolean | null | undefined): Field => ({
    label: 'Diesel?',
    draw: (x, yTop) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(MUTE);
      doc.text('DIESEL?', x, yTop + 3.2);
      const cy = yTop + 8;
      let cx = x;
      cx += drawCheck(cx, cy, val === true, 'Sim');
      drawCheck(cx, cy, val === false, 'Não');
      return 11;
    },
  });

  // ----- tabela
  const table = (headers: string[], rows: string[][], widths?: number[]) => {
    const totalW = CW;
    const w = widths && widths.length === headers.length
      ? widths.map((x) => (x / widths.reduce((a, b) => a + b, 0)) * totalW)
      : headers.map(() => totalW / headers.length);

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
        const lines = doc.splitTextToSize(h, w[idx] - 2);
        doc.text(lines, cx + w[idx] / 2, y + (headerH / 2) - (lines.length - 1) * 1.3 + 1, { align: 'center' });
        cx += w[idx];
      });
      y += headerH;
    };

    drawHead();

    if (rows.length === 0) {
      ensure(7);
      setFill(WHITE);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      setText(MUTE);
      doc.text('Sem registros', MX + totalW / 2, y + 5, { align: 'center' });
      setDraw(LINE);
      doc.setLineWidth(0.2);
      doc.rect(MX, y, totalW, 7.5);
      y += 9;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    rows.forEach((row, ridx) => {
      const cellLines = row.map((c, idx) => doc.splitTextToSize(c || 'Não informado', w[idx] - 3));
      const rowH = Math.max(6.5, ...cellLines.map((l) => 3 + l.length * 3.4));
      if (y + rowH > BOTTOM) {
        // quebra: repete cabeçalho na nova página
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
        doc.text(lines, cx + w[idx] / 2, y + 4.2, { align: 'center' });
        cx += w[idx];
      });
      setDraw(LINE);
      doc.setLineWidth(0.15);
      doc.line(MX, y + rowH, MX + totalW, y + rowH);
      y += rowH;
    });
    // contorno
    setDraw(LINE);
    doc.setLineWidth(0.25);
    doc.line(MX, y, MX + totalW, y);
    y += 3;
  };

  // ----- ocorrências
  const occurrences = (value: string) => {
    sectionTitle('Ocorrências');
    const v = txt(value) || 'Sem ocorrências registradas';
    doc.setFont('helvetica', txt(value) ? 'normal' : 'italic');
    doc.setFontSize(8.5);
    setText(txt(value) ? BODY : MUTE);
    const lines = doc.splitTextToSize(v, CW - 4);
    ensure(lines.length * 4 + 3);
    doc.text(lines, MX + 2, y + 3.5);
    y += lines.length * 4 + 4;
  };

  // ----- assinaturas (mantém junto, no fim)
  const signatures = () => {
    const blockH = 36;
    ensure(blockH + 2);
    sectionTitle('Assinaturas');
    const colW = CW / 2;
    const boxH = 30;
    const drawSig = (x: number, who: string, name: string, img: LoadedImage | null, cpf: string, emptyLine: boolean) => {
      setDraw(LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, colW - 3, boxH, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(MUTE);
      doc.text(who.toUpperCase(), x + 3, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(INK);
      doc.text(name || '-', x + 3, y + 9);
      // área de assinatura
      const areaY = y + 11;
      const areaH = 12;
      if (img) {
        const h = Math.min(areaH, (colW - 12) / img.ratio);
        try {
          doc.addImage(img.dataUrl, img.format, x + 3, areaY + (areaH - h) / 2, h * img.ratio, h);
        } catch { /* ignora imagem inválida */ }
      } else if (emptyLine) {
        setDraw([150, 160, 155]);
        doc.setLineWidth(0.3);
        doc.line(x + 4, areaY + areaH - 1, x + colW - 8, areaY + areaH - 1);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(MUTE);
      doc.text(`CPF: ${cpf || '—'}`, x + 3, y + boxH - 2.5);
    };

    const cliName = (() => {
      const raw = txt(diary?.responsibleSignedBy || diary?.responsibleSignature);
      if (/assinatura externa/i.test(raw)) return '';
      return raw;
    })();

    drawSig(MX, 'Responsável Geoteste', txt(diary?.geotestSignature), geoSig, formatCpf(diary?.geotestCpf), false);
    drawSig(MX + colW, 'Cliente', cliName, cliSig, formatCpf(diary?.responsibleCpf), !cliSig);
    y += boxH + 2;
  };

  // ============================================================ render
  drawHeader();

  if (kind === 'PCE') {
    const d = pceDetail || {};
    const heli = d.ensaio_tipo === 'PCE HELICOIDAL';
    sectionTitle('Identificação');
    fieldsGrid([
      { label: 'Equipamento', value: orNI(d.cravacao_equipamento || 'PCE') },
      { label: 'Início', value: formatTime24h(diary?.startTime) || '-' },
      { label: 'Término', value: formatTime24h(diary?.endTime) || '-' },
      { label: 'Equipe', value: orNI(diary?.team), span: 2 },
      climateField(),
    ], 5);

    sectionTitle('Dados do ensaio');
    fieldsGrid([
      { label: 'Tipo', value: orNI(d.ensaio_tipo), span: 2 },
      { label: 'Carregamento', value: Array.isArray(d.carregamento_tipos) && d.carregamento_tipos.length ? d.carregamento_tipos.join(', ') : 'Não informado', span: 2 },
      { label: 'Macaco', value: orNI(d.equipamentos_macaco) },
      { label: heli ? 'Célula de carga' : 'Célula', value: orNI(d.equipamentos_celula) },
      { label: 'Manômetro', value: orNI(d.equipamentos_manometro) },
      { label: 'Relógios', value: orNI(d.equipamentos_relogios) },
      { label: 'Vigas', value: orNI(d.equipamentos_conjunto_vigas), span: 4 },
    ], 4);

    sectionTitle('Estacas');
    if (heli) {
      table(
        ['Estaca', 'Tipo', 'Prof. (m)', 'Carga trab. (tf)', 'Carga ensaio (tf)', 'Diâm. (cm)'],
        pcePiles.map((p) => [orNI(p.estaca_nome), orNI(p.estaca_tipo), orNI(p.estaca_profundidade_m), orNI(p.estaca_carga_trabalho_tf), orNI(p.estaca_carga_ensaio_tf), orNI(p.estaca_diametro_cm)]),
        [0.9, 0.9, 1.2, 1.2, 1.2, 1],
      );
    } else {
      table(
        ['Estaca', 'Tipo', 'Prof. (m)', 'Carga (tf)', 'Diâm. (cm)'],
        pcePiles.map((p) => [orNI(p.estaca_nome), orNI(p.estaca_tipo), orNI(p.estaca_profundidade_m), orNI(p.estaca_carga_trabalho_tf), orNI(p.estaca_diametro_cm)]),
        [1, 0.9, 1.3, 1, 1],
      );
    }

    if (heli) {
      sectionTitle('Cravação e abastecimento');
      fieldsGrid([
        { label: 'Equipamento cravação', value: orNI(d.cravacao_equipamento), span: 2 },
        { label: 'Horímetro', value: orNI(d.cravacao_horimetro), span: 2 },
        { label: 'Mobilização Tanque (L)', value: orNI(d.abastecimento_mobilizacao_litros_tanque) },
        { label: 'Mobilização Galão (L)', value: orNI(d.abastecimento_mobilizacao_litros_galao) },
        { label: 'Final Tanque (L)', value: orNI(d.abastecimento_finaldia_litros_tanque) },
        { label: 'Final Galão (L)', value: orNI(d.abastecimento_finaldia_litros_galao) },
        dieselField(d.abastecimento_chegou_diesel),
        { label: 'Fornecido por', value: orNI(d.abastecimento_fornecido_por) },
        { label: 'Quantidade (L)', value: orNI(d.abastecimento_quantidade_litros) },
        { label: 'Horário', value: formatTime24h(d.abastecimento_horario_chegada) || '-' },
      ], 4);
    }

    occurrences(d.ocorrencias || diary?.observations);
  } else if (kind === 'PIT') {
    const d = pitDetail || {};
    sectionTitle('Identificação');
    fieldsGrid([
      { label: 'Equipamento', value: orNI(d.equipamento || 'PIT') },
      { label: 'Início', value: formatTime24h(diary?.startTime) || '-' },
      { label: 'Término', value: formatTime24h(diary?.endTime) || '-' },
      { label: 'Equipe', value: orNI(diary?.team), span: 2 },
      climateField(),
    ], 5);

    sectionTitle('Dados do ensaio');
    fieldsGrid([
      { label: 'Total estacas', value: orNI(d.total_estacas) },
      { label: 'Estacas ensaiadas', value: orNI(d.estacas_ensaiadas) },
      { label: 'Horímetro', value: orNI(d.horimetro), span: 2 },
    ], 4);

    sectionTitle('Estacas');
    table(
      ['Estaca', 'Tipo', 'Diâm. (cm)', 'Prof. (cm)', 'Arrasamento (m)', 'Comp. útil (m)'],
      pitPiles.map((p) => [orNI(p.estaca_nome), orNI(p.estaca_tipo), orNI(p.diametro_cm), orNI(p.profundidade_cm), orNI(p.arrasamento_m), orNI(p.comprimento_util_m)]),
      [0.9, 0.9, 1, 1, 1, 1.2],
    );

    occurrences(d.ocorrencias || diary?.observations);
  } else if (kind === 'PLACA') {
    const d = placaDetail || {};
    sectionTitle('Identificação');
    fieldsGrid([
      { label: 'Equipamento', value: orNI(d.equipamentos_equipamento_reacao || 'PLACA') },
      { label: 'Início', value: formatTime24h(diary?.startTime) || '-' },
      { label: 'Término', value: formatTime24h(diary?.endTime) || '-' },
      { label: 'Equipe', value: orNI(diary?.team), span: 2 },
      climateField(),
    ], 5);

    sectionTitle('Equipamentos');
    fieldsGrid([
      { label: 'Macaco', value: orNI(d.equipamentos_macaco) },
      { label: 'Célula', value: orNI(d.equipamentos_celula_carga) },
      { label: 'Manômetro', value: orNI(d.equipamentos_manometro) },
      { label: 'Placa', value: orNI(d.equipamentos_placa_dimensoes) },
      { label: 'Reação', value: orNI(d.equipamentos_equipamento_reacao) },
      { label: 'Relógios', value: orNI(d.equipamentos_relogios) },
    ], 3);

    sectionTitle('Pontos');
    table(
      ['Ponto', 'Carga 1 (kgf/cm²)', 'Carga 2 (kgf/cm²)'],
      placaPiles.map((p) => [orNI(p.nome), orNI(p.carga_trabalho_1_kgf_cm2), orNI(p.carga_trabalho_2_kgf_cm2)]),
      [1, 1.2, 1.2],
    );

    occurrences(d.ocorrencias || diary?.observations);
  } else if (kind === 'PDA') {
    const d = pdaDiarioDetail || {};
    const comps = Array.isArray(d.pda_computadores) ? d.pda_computadores.join(', ') : txt(d.pda_computadores);
    sectionTitle('Identificação');
    fieldsGrid([
      { label: 'Equipamento', value: comps || 'PDA' },
      { label: 'Início', value: formatTime24h(diary?.startTime) || '-' },
      { label: 'Término', value: formatTime24h(diary?.endTime) || '-' },
      { label: 'Equipe', value: orNI(diary?.team), span: 2 },
      climateField(),
    ], 5);

    sectionTitle('Estacas');
    table(
      ['Estaca', 'Tipo', 'Diâm. (cm)', 'Prof. (m)', 'Carga trab. (tf)', 'Carga ensaio (tf)'],
      pdaDiarioPiles.map((p) => [orNI(p.nome), orNI(p.tipo), orNI(p.diametro_cm), orNI(p.profundidade_m), orNI(p.carga_trabalho_tf), orNI(p.carga_ensaio_tf)]),
      [0.9, 0.9, 1, 1.2, 1.2, 1.2],
    );

    sectionTitle('Operação e abastecimento');
    fieldsGrid([
      { label: 'Computadores', value: comps || 'Não informado', span: 2 },
      { label: 'Horímetro', value: orNI(d.horimetro_horas), span: 2 },
      { label: 'Equipamentos abastecidos', value: Array.isArray(d.abastec_equipamentos) && d.abastec_equipamentos.length ? d.abastec_equipamentos.join(', ') : 'Não informado', span: 4 },
      { label: 'Mobilização Tanque (L)', value: orNI(d.mobilizacao_litros_tanque) },
      { label: 'Mobilização Galão (L)', value: orNI(d.mobilizacao_litros_galao) },
      { label: 'Final Tanque (L)', value: orNI(d.finaldia_litros_tanque) },
      { label: 'Final Galão (L)', value: orNI(d.finaldia_litros_galao) },
      dieselField(d.entrega_chegou_diesel),
      { label: 'Fornecido por', value: orNI(d.entrega_fornecido_por) },
      { label: 'Quantidade (L)', value: orNI(d.entrega_quantidade_litros) },
      { label: 'Horário', value: formatTime24h(d.entrega_horario_chegada) || '-' },
    ], 4);

    occurrences(d.ocorrencias || diary?.observations);
  } else {
    sectionTitle('Identificação');
    fieldsGrid([
      { label: 'Início', value: formatTime24h(diary?.startTime) || '-' },
      { label: 'Término', value: formatTime24h(diary?.endTime) || '-' },
      { label: 'Equipe', value: orNI(diary?.team), span: 3 },
      climateField(),
    ], 5);
    occurrences(diary?.observations);
  }

  signatures();
  drawFooter();
  return doc;
}

/** Gera e baixa o PDF do diário. */
export async function generateDiaryPdf(data: DiaryPdfData, fileName: string): Promise<void> {
  const doc = await buildDiaryDoc(data);
  doc.save(fileName);
}

/** Gera o PDF e retorna uma URL de blob para visualização (iframe/embed). */
export async function diaryPdfBlobUrl(data: DiaryPdfData): Promise<string> {
  const doc = await buildDiaryDoc(data);
  return doc.output('bloburl') as unknown as string;
}
