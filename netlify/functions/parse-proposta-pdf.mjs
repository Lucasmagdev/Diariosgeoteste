// Le o PDF padrao de proposta comercial da Geoteste (capa + "Dados Iniciais" +
// tabela de orcamento + condicoes de pagamento) e devolve os campos ja
// estruturados pra autopreencher o formulario de propostas no Diario.
//
// Extracao de texto via pdfjs-dist (build "legacy", roda em Node sem canvas —
// so precisamos do texto, nao de renderizar paginas). O texto de PDF nao vem
// com colunas/tabelas marcadas, entao os valores sao lidos por rotulo
// ("Cliente:", "CNPJ:", "Validade da Proposta:" etc.), nao por posicao fixa.
// Extracao e "melhor esforco": o admin sempre revisa/edita antes de salvar.
// pdfjs-dist, sem worker de verdade (Node), acha o WorkerMessageHandler por
// um import() dinamico com caminho relativo (`./pdf.worker.mjs`) resolvido
// a partir do PROPRIO arquivo do modulo — funciona com node_modules intacto,
// mas quebra assim que o bundler da Netlify Function junta tudo num arquivo
// so (o caminho relativo deixa de existir). Import estatico do worker aqui
// e registro em globalThis.pdfjsWorker faz o pdfjs-dist achar o handler
// direto, sem precisar desse import() dinamico — funciona bundlado ou nao.
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
globalThis.pdfjsWorker = pdfjsWorker;
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const MODALIDADES = ['PIT', 'PDA', 'PCE', 'PLACA', 'HAMMER'];

// Junta os "items" de texto de uma pagina em linhas, agrupando por
// coordenada Y (mesma linha visual) e usando o espaco X entre itens pra
// decidir se precisa de um espaco entre eles (evita colar palavras, e evita
// espaco extra dentro de uma mesma palavra quebrada em glifos).
const pageToLines = (content) => {
  const rows = [];
  let current = null;
  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue;
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    if (!current || Math.abs(y - current.y) > 3) {
      if (current) rows.push(current);
      current = { y, parts: [{ x, str: item.str, width: item.width || 0 }] };
    } else {
      current.parts.push({ x, str: item.str, width: item.width || 0 });
    }
  }
  if (current) rows.push(current);

  return rows.map((row) => {
    row.parts.sort((a, b) => a.x - b.x);
    let line = '';
    let prevEnd = null;
    for (const part of row.parts) {
      if (prevEnd !== null) {
        const gap = part.x - prevEnd;
        line += gap > 1.5 ? ' ' : '';
      }
      line += part.str;
      prevEnd = part.x + part.width;
    }
    return line.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
};

const extractPages = async (data) => {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(pageToLines(content));
  }
  return pages;
};

const parseBRL = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
};

const findLine = (lines, labelRegex) => {
  for (const line of lines) {
    const match = line.match(labelRegex);
    if (match) return match[1]?.trim() || null;
  }
  return null;
};

const detectModalidadeFromText = (text) => {
  for (const mod of MODALIDADES) {
    if (new RegExp(`\\b${mod}\\b`, 'i').test(text)) return mod;
  }
  if (/\bPCP\b/i.test(text)) return 'PLACA';
  return null;
};

const detectModalidadeFromFilename = (fileName) => {
  const upper = (fileName || '').toUpperCase();
  return MODALIDADES.find((mod) => upper.includes(mod)) || null;
};

const parseCidadeUf = (endereco) => {
  if (!endereco) return { cidade: null, uf: null };
  const match = endereco.match(/([A-Za-zÀ-ÿ' ]+)\/([A-Za-z]{2})\s*$/);
  if (!match) return { cidade: null, uf: null };
  return { cidade: match[1].trim(), uf: match[2].toUpperCase() };
};

const parseDateBR = (raw) => {
  const match = raw?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

// Numero/revisao vem como "Nº:   16012026 N 0 034   –   Rev0 1" (fontes com
// glifos separados quebram o numero em varios pedacos) — remove todo espaco
// interno da linha inteira antes de separar numero de revisao, ja que o
// codigo em si nunca tem espaco de verdade.
const parseNumeroRevisao = (rawLine) => {
  if (!rawLine) return { numero: null, revisao: null };
  const noSpaces = rawLine.replace(/\s+/g, '');
  const match = noSpaces.match(/^(.*?)[–-](Rev\w*)$/i);
  if (match) return { numero: match[1] || null, revisao: match[2] || null };
  return { numero: noSpaces || null, revisao: null };
};

// Tabela do orcamento: entre a linha com "Descrição" + "Und" + "Qtd" e a
// linha "Total". Cada linha de item tem, no fim, dois valores em R$ (unitario
// e estimado); o que sobra antes é descricao + und + qtd, lido de tras pra
// frente pra nao depender de colunas alinhadas.
const parseItensOrcamento = (lines) => {
  const headerIdx = lines.findIndex((l) => /descri[cç][aã]o/i.test(l) && /und/i.test(l) && /qtd/i.test(l));
  if (headerIdx === -1) return { itens: [], valorTotal: null };

  const itens = [];
  let valorTotal = null;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^total\b/i.test(line)) {
      const values = [...line.matchAll(/R\$\s*[\d.,]+/g)].map((m) => m[0]);
      valorTotal = parseBRL(values[values.length - 1]);
      break;
    }
    const values = [...line.matchAll(/R\$\s*[\d.,]+/g)].map((m) => m[0]);
    if (values.length < 2) continue; // linha de continuacao/nota, ignora
    const valorUnitario = parseBRL(values[0]);
    const valorEstimado = parseBRL(values[values.length - 1]);
    const beforeValues = line.slice(0, line.indexOf(values[0])).trim();
    const qtdMatch = beforeValues.match(/(\d+)\s*$/);
    const quantidade = qtdMatch ? Number(qtdMatch[1]) : null;
    const restante = qtdMatch ? beforeValues.slice(0, qtdMatch.index).trim() : beforeValues;
    const unidadeMatch = restante.match(/(\S+)\s*$/);
    const unidade = unidadeMatch ? unidadeMatch[1] : null;
    let descricao = unidadeMatch ? restante.slice(0, unidadeMatch.index).trim() : restante;

    // Linha de item quebrada em varias no PDF (descricao longa ocupando uma
    // ou mais linhas, com unidade/qtd/valores so na ultima) — a descricao de
    // verdade fica nas linhas anteriores, que nao tem nenhum valor em R$.
    if (!descricao) {
      const wrapped = [];
      let j = i - 1;
      while (j > headerIdx && !/R\$/.test(lines[j])) {
        wrapped.unshift(lines[j].trim());
        j--;
      }
      if (wrapped.length) descricao = wrapped.join(' ');
    }

    itens.push({
      descricao: descricao || restante,
      unidade,
      quantidade,
      valorUnitario,
      valorEstimado,
    });
  }
  return { itens, valorTotal };
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Payload inválido.' }, 400);
  }

  const { fileBase64, fileName } = body || {};
  if (!fileBase64) return json({ error: 'Nenhum arquivo enviado.' }, 400);

  let data;
  try {
    data = Uint8Array.from(Buffer.from(fileBase64, 'base64'));
  } catch {
    return json({ error: 'Arquivo em base64 inválido.' }, 400);
  }

  try {
    const pages = await extractPages(data);
    const coverLines = pages[0] || [];
    const dadosLines = pages[1] || [];
    const allLinesJoined = pages.flat().join('\n');
    const orcamentoPageLines = pages.find((p) => p.some((l) => /or[cç]amento \(prazos/i.test(l))) || [];
    const lastPageLines = pages[pages.length - 1] || [];

    const modalidade = detectModalidadeFromText(coverLines.join(' '))
      || detectModalidadeFromFilename(fileName)
      || detectModalidadeFromText(allLinesJoined);

    const numeroLineRaw = coverLines.find((l) => /^N[ºo°]\s*:/i.test(l)) || '';
    const { numero, revisao } = parseNumeroRevisao(numeroLineRaw.replace(/^N[ºo°]\s*:/i, ''));

    const clienteCapa = findLine(coverLines, /^Cliente\s*:\s*(.+)$/i);
    const obraNome = findLine(coverLines, /^Obra\s*:\s*(.+)$/i);

    const clienteNome = findLine(dadosLines, /^Nome Da Empresa\s*:\s*(.+)$/i) || clienteCapa;
    const cnpjRaw = findLine(dadosLines, /^CNPJ\s*:\s*(.+)$/i);
    const cnpj = cnpjRaw ? cnpjRaw.replace(/\s+/g, '') : null;
    const contatoNome = findLine(dadosLines, /^A\/C\s*:\s*(.+)$/i);
    const telRaw = findLine(dadosLines, /^Tel\.?\s*:\s*(.+)$/i);
    const contatoTelefone = telRaw ? telRaw.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim() : null;
    const enderecoObra = findLine(dadosLines, /^Endere[cç]o da Obra\s*:\s*(.+)$/i);
    const responsavelComercial = findLine(dadosLines, /^Respons[aá]vel Comercial\s*:\s*(.+)$/i);
    const contatoComercialRaw = findLine(dadosLines, /^Contato Comercial\s*:\s*(.+)$/i);
    const contatoComercial = contatoComercialRaw ? contatoComercialRaw.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim() : null;
    const sondagem = findLine(dadosLines, /^Sondagem\s*:\s*(.+)$/i);
    const projetoFundacoes = findLine(dadosLines, /^Projeto de Funda[cç][oõ]es\s*:\s*(.+)$/i);

    const { cidade, uf } = parseCidadeUf(enderecoObra);

    const validadeRaw = findLine(orcamentoPageLines, /Validade da Proposta\s*:\s*(\d+)/i);
    const validadeDias = validadeRaw ? Number(validadeRaw) : null;

    const { itens, valorTotal } = parseItensOrcamento(orcamentoPageLines);

    const entradaMatch = allLinesJoined.match(/valor total\s*de\s*R\$\s*([\d.,]+)/i);
    const valorEntrada = entradaMatch ? parseBRL(entradaMatch[1]) : null;

    const periodicidadeMatch = allLinesJoined.match(/medi[cç][oõ]es e cobran[cç]as,?\s*(semanais|quinzenais|mensais|di[aá]rias)/i);
    const periodicidadeMedicao = periodicidadeMatch ? periodicidadeMatch[1].toLowerCase() : null;

    const prazoPagamentoMatch = allLinesJoined.match(/prazo de pagamento de\s*(\d+)/i);
    const prazoPagamentoDias = prazoPagamentoMatch ? Number(prazoPagamentoMatch[1]) : null;

    const dataAcordoRaw = findLine(lastPageLines, /De acordo em\s*:\s*(.+)$/i);
    const dataProposta = parseDateBR(dataAcordoRaw);

    return json({
      numero,
      revisao,
      modalidade,
      clienteNome,
      clienteCnpj: cnpj,
      obraNome,
      enderecoObra,
      cidade,
      uf,
      contatoNome,
      contatoTelefone,
      responsavelComercial,
      contatoComercial,
      sondagem,
      projetoFundacoes,
      validadeDias,
      valorTotal,
      valorEntrada,
      periodicidadeMedicao,
      prazoPagamentoDias,
      dataProposta,
      itens,
    });
  } catch (error) {
    console.error('parse-proposta-pdf: falha ao processar PDF', error);
    return json({ error: 'Não foi possível ler este PDF. Confira se é o modelo padrão de proposta.' }, 422);
  }
};
