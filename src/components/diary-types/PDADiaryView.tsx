import React from 'react';
import { PdfClimateRow, PdfLayout, PdfRow, PdfSection, PdfTable } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';
import { ClientSignatureValue } from './ClientSignatureValue';
import { formatTime24h } from '../../utils/time';

interface PDADiaryViewProps {
  diary: any;
  fichapdaDetail: any;
  pdaDiarioDetail: any;
  pdaDiarioPiles: any[];
}

const joinOrDash = (input?: string | string[]) => {
  if (!input) return '-';
  if (Array.isArray(input)) {
    const filtered = input.filter(Boolean);
    return filtered.length ? filtered.join(', ') : '-';
  }
  return input;
};

export const PDADiaryView: React.FC<PDADiaryViewProps> = ({
  diary,
  pdaDiarioDetail,
  pdaDiarioPiles = [],
}) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA • PDA">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={pdaDiarioDetail?.pda_computadores ? (Array.isArray(pdaDiarioDetail.pda_computadores) ? pdaDiarioDetail.pda_computadores.join(', ') : pdaDiarioDetail.pda_computadores) : 'PDA'} />
        <PdfRow label="Início" value={formatTime24h(diary.startTime)} />
        <PdfRow label="Término" value={formatTime24h(diary.endTime)} />
        <PdfRow label="Equipe" value={diary.team} span={2} />
        <PdfRow label="Endereço" value={diary.address} span={5} />
      </PdfSection>

      <section className="border border-gray-400">
        <div className="bg-gray-200 border-b border-gray-400 px-0.5 py-0.5 font-bold uppercase text-[6px] flex items-center">
          Clima
        </div>
        <PdfClimateRow
          ensolarado={!!diary?.weather_ensolarado}
          chuvaFraca={!!diary?.weather_chuva_fraca}
          chuvaForte={!!diary?.weather_chuva_forte}
        />
      </section>

      <section className="border border-gray-400 mb-1" data-pdf-section="estacas">
        <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 font-bold uppercase text-[7px]">
          Estacas
        </div>
        <div className="p-1.5">
          <PdfTable
            headers={['Estaca', 'Tipo', 'Diâmetro (cm)', 'Profundidade (metros)', 'Carga de trabalho (tf)', 'Carga de ensaio (tf)']}
            columnWidths="0.9fr 0.9fr 1fr 1.2fr 1.2fr 1.2fr"
            compactHeaders
            rows={pdaDiarioPiles.map((pile) => [
              pile.nome || '-',
              pile.tipo || '-',
              pile.diametro_cm || '-',
              pile.profundidade_m || '-',
              pile.carga_trabalho_tf || '-',
              pile.carga_ensaio_tf || '-',
            ])}
          />
        </div>
      </section>

      <PdfSection columns={4} title="Operação PDA">
        <PdfRow label="Computadores" value={joinOrDash(pdaDiarioDetail?.pda_computadores)} span={2} />
        <PdfRow label="Horímetro" value={pdaDiarioDetail?.horimetro_horas ?? '-'} span={2} />
        <PdfRow label="Equipamentos abastecidos" value={joinOrDash(pdaDiarioDetail?.abastec_equipamentos)} span={4} />
        <PdfRow label="Ocorrências" value={pdaDiarioDetail?.ocorrencias || diary.observations || '-'} span={4} />
      </PdfSection>

      <PdfSection columns={4} title="Abastecimento">
        <PdfRow label="Mobilização Tanque (L)" value={pdaDiarioDetail?.mobilizacao_litros_tanque ?? '-'} />
        <PdfRow label="Mobilização Galão (L)" value={pdaDiarioDetail?.mobilizacao_litros_galao ?? '-'} />
        <PdfRow label="Final Tanque (L)" value={pdaDiarioDetail?.finaldia_litros_tanque ?? '-'} />
        <PdfRow label="Final Galão (L)" value={pdaDiarioDetail?.finaldia_litros_galao ?? '-'} />
        <PdfRow
          label="Diesel?"
          value={
            <div className="grid grid-cols-2 gap-3 w-full text-[7px] leading-[10px]">
              <span className="whitespace-nowrap">{pdaDiarioDetail?.entrega_chegou_diesel === true ? '\u2611' : '\u2610'} Sim</span>
              <span className="whitespace-nowrap">{pdaDiarioDetail?.entrega_chegou_diesel === false ? '\u2611' : '\u2610'} Não</span>
            </div>
          }
          />
        <PdfRow label="Fornecido por" value={pdaDiarioDetail?.entrega_fornecido_por || '-'} />
        <PdfRow label="Quantidade (L)" value={pdaDiarioDetail?.entrega_quantidade_litros ?? '-'} />
        <PdfRow label="Horário" value={formatTime24h(pdaDiarioDetail?.entrega_horario_chegada)} />
      </PdfSection>

      <PdfSection title="Assinaturas" columns={2}>
        <PdfRow
          label="Geoteste"
          value={<GeotestSignatureValue diary={diary} />}
        />
        <PdfRow label="Cliente" value={<ClientSignatureValue diary={diary} />} />
      </PdfSection>
    </PdfLayout>
  );
};
