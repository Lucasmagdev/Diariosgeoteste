import jsPDF from 'jspdf';
import { parsePte, processBlow, countBlows, marcarBatidasFracas, BlowResult, VelocityPoint } from './pte';

interface BestBlow {
  index: number;
  result: BlowResult;
  peak: number;
  weak: boolean;
  totalBlows: number;
}

// Escolhe o "golpe bom" pra representar o ensaio: o operador costuma dar
// um ou dois golpes de teste (fracos) antes do golpe valido, e todos
// ficam gravados no mesmo arquivo. marcarBatidasFracas identifica os
// fracos comparando com o pico maximo do arquivo — entre os que sobram,
// pega o mais forte.
function pickBestBlow(pte: ReturnType<typeof parsePte>): BestBlow | null {
  const totalBlows = countBlows(pte);
  const attempts: { idx: number; result?: BlowResult; peak?: number }[] = [];
  for (let i = 0; i < totalBlows; i++) {
    try {
      const result = processBlow(pte, i, { channel: 0 });
      const peak = result.points.reduce((m, p) => Math.max(m, Math.abs(p.v)), 0);
      attempts.push({ idx: i, result, peak });
    } catch {
      attempts.push({ idx: i });
    }
  }

  const fracas = marcarBatidasFracas(attempts.map((a) => a.peak));
  const candidates = attempts
    .map((a, i) => ({ ...a, weak: fracas[i] }))
    .filter((a): a is { idx: number; result: BlowResult; peak: number; weak: boolean } => Boolean(a.result) && (a.peak ?? 0) > 0);
  if (candidates.length === 0) return null;

  const strong = candidates.filter((c) => !c.weak);
  const pool = strong.length > 0 ? strong : candidates;
  const chosen = pool.reduce((best, c) => (c.peak > best.peak ? c : best));
  return { index: chosen.idx, result: chosen.result, peak: chosen.peak, weak: chosen.weak, totalBlows };
}

// Reduz a milhares de amostras pra ~900 buckets sem perder os picos:
// guarda o minimo E o maximo de cada bucket (uma media simples acharia
// os picos, que é justo o que importa num reflectograma).
function decimateMinMax(points: VelocityPoint[], targetBuckets: number): VelocityPoint[] {
  if (points.length <= targetBuckets * 2) return points;
  const bucketSize = points.length / targetBuckets;
  const out: VelocityPoint[] = [];
  for (let b = 0; b < targetBuckets; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(points.length, Math.floor((b + 1) * bucketSize));
    if (end <= start) continue;
    let minP = points[start];
    let maxP = points[start];
    for (let i = start; i < end; i++) {
      if (points[i].v < minP.v) minP = points[i];
      if (points[i].v > maxP.v) maxP = points[i];
    }
    if (minP.x <= maxP.x) out.push(minP, maxP);
    else out.push(maxP, minP);
  }
  return out;
}

export interface GenerateSinalPdfOptions {
  estacaNome: string;
  diaryLabel?: string;
  fileName: string;
}

/** Gera e baixa um PDF com o grafico do sinal (velocidade x profundidade)
 * a partir do arquivo .PTE bruto do ensaio. Escala relativa, nao calibrada
 * em unidade fisica — serve pra leitura visual do reflectograma. */
export async function generateSinalPdf(arrayBuffer: ArrayBuffer, opts: GenerateSinalPdfOptions): Promise<void> {
  const pte = parsePte(arrayBuffer);
  const best = pickBestBlow(pte);
  if (!best) throw new Error('Não foi possível processar o sinal deste arquivo.');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MX = 15;
  const MY = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 51);
  doc.text(`Sinal do ensaio PIT — Estaca ${opts.estacaNome}`, MX, MY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 108);
  let infoY = MY + 6;
  if (opts.diaryLabel) {
    doc.text(opts.diaryLabel, MX, infoY);
    infoY += 5;
  }
  const weakNote = best.weak ? ' (apenas golpes fracos/teste disponíveis)' : '';
  doc.text(`Golpe ${best.index + 1} de ${best.totalBlows}${weakNote}`, MX, infoY);
  infoY += 5;
  const p = best.result.params;
  doc.text(
    `WS=${p.WS.toFixed(0)} m/s   LE=${p.LE.toFixed(2)} m   MD=${p.MD.toFixed(2)} m   MA=${p.MA.toFixed(2)}   FS=${p.FS.toFixed(0)} Hz`,
    MX,
    infoY,
  );

  const plotX = MX;
  const plotY = infoY + 10;
  const plotW = PW - MX * 2;
  const plotH = PH - plotY - 20;

  const pts = decimateMinMax(best.result.points, 900);
  const xMin = 0;
  const xMax = Math.max(p.LE, ...pts.map((pt) => pt.x), 0.01);
  const vMax = Math.max(...pts.map((pt) => Math.abs(pt.v)), 1e-9);

  doc.setDrawColor(180, 190, 185);
  doc.setLineWidth(0.25);
  doc.rect(plotX, plotY, plotW, plotH);

  const toXpix = (x: number) => plotX + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const toYpix = (v: number) => plotY + plotH / 2 - (v / vMax) * (plotH / 2) * 0.95;

  doc.setDrawColor(225, 230, 228);
  doc.setLineWidth(0.15);
  const ticks = 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 138);
  for (let i = 0; i <= ticks; i++) {
    const x = xMin + (xMax - xMin) * (i / ticks);
    const px = toXpix(x);
    doc.line(px, plotY, px, plotY + plotH);
    doc.text(x.toFixed(1), px, plotY + plotH + 5, { align: 'center' });
  }

  const yZero = toYpix(0);
  doc.setDrawColor(205, 216, 211);
  doc.setLineWidth(0.2);
  doc.line(plotX, yZero, plotX + plotW, yZero);

  doc.setDrawColor(21, 107, 79);
  doc.setLineWidth(0.35);
  for (let i = 1; i < pts.length; i++) {
    doc.line(toXpix(pts[i - 1].x), toYpix(pts[i - 1].v), toXpix(pts[i].x), toYpix(pts[i].v));
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 75);
  doc.text('Profundidade (m)', plotX + plotW / 2, plotY + plotH + 11, { align: 'center' });
  doc.text('Velocidade (relativa)', plotX, plotY - 3);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 150, 158);
  doc.text(
    'Gerado a partir do arquivo bruto do ensaio (.PTE). Escala relativa, não calibrada em unidade física — use o .PTE original no software do fabricante para análise oficial.',
    plotX,
    PH - 8,
  );

  doc.save(opts.fileName);
}
