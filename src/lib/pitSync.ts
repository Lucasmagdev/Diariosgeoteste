import { extractGeneralParams, parsePte, TlvRecord } from './pte';
import { supabase } from './supabaseClient';

export interface PitRemoteEnsaio {
  id: string;
  nomeOriginal: string;
  pastaOrigem: string | null;
  criadoNoEquipamento: string;
  downloadUrl: string;
}

export interface PitImportedPile {
  ensaioOrigemId: string;
  estacaNome: string;
  estacaTipo: string;
  diametroCm: string;
  profundidadeM: string;
  arrasamentoM: string;
  comprimentoUtilM: string;
  confirmado: boolean;
  isExpanded: boolean;
}

interface PitSyncResponse {
  ensaios?: PitRemoteEnsaio[];
  error?: string;
}

const normalizedTag = (tag: string) => tag.replace(/^0+/, '');

const getNumericField = (records: TlvRecord[], tag: string): number | null => {
  const field = records.find((record) => normalizedTag(record.tag) === normalizedTag(tag));
  return field?.kind === 'num' && typeof field.value === 'number' && Number.isFinite(field.value)
    ? field.value
    : null;
};

const formatMeasurement = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(Number.isInteger(rounded) ? 0 : 2).replace('.', ',');
};

export const extractPitPile = (arrayBuffer: ArrayBuffer, ensaio: PitRemoteEnsaio): PitImportedPile => {
  const parsed = parsePte(arrayBuffer);
  const generalHeader = parsed.blocks[0]?.headerRecords;
  if (!generalHeader?.length) throw new Error('Cabeçalho do arquivo PTE não encontrado.');

  const { LE } = extractGeneralParams(generalHeader);
  const sectionAreaM2 = getNumericField(generalHeader, '0413');
  const diameterCm = sectionAreaM2 && sectionAreaM2 > 0
    ? 2 * Math.sqrt(sectionAreaM2 / Math.PI) * 100
    : null;

  return {
    ensaioOrigemId: ensaio.id,
    estacaNome: ensaio.nomeOriginal.replace(/\.[^.]+$/, ''),
    estacaTipo: '',
    diametroCm: diameterCm ? formatMeasurement(diameterCm) : '',
    profundidadeM: LE > 0 ? formatMeasurement(LE) : '',
    arrasamentoM: '',
    comprimentoUtilM: '',
    confirmado: false,
    isExpanded: true,
  };
};

export const fetchPitEnsaios = async (diaryDate: string): Promise<PitRemoteEnsaio[]> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente para sincronizar.');

  const response = await fetch('/.netlify/functions/pit-ensaios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ date: diaryDate }),
  });

  const payload = await response.json().catch(() => ({})) as PitSyncResponse;
  if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar os ensaios do PIT.');
  return Array.isArray(payload.ensaios) ? payload.ensaios : [];
};

export const downloadPitPiles = async (ensaios: PitRemoteEnsaio[]) => {
  const results = await Promise.allSettled(ensaios.map(async (ensaio) => {
    const response = await fetch(ensaio.downloadUrl);
    if (!response.ok) throw new Error(`Falha ao baixar ${ensaio.nomeOriginal}.`);
    return extractPitPile(await response.arrayBuffer(), ensaio);
  }));

  return {
    piles: results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []),
    failed: results.filter((result) => result.status === 'rejected').length,
  };
};
