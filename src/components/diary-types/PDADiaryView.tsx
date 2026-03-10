import React from 'react';
import { PdfLayout, PdfRow, PdfSection, PdfTable, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';

interface PDADiaryViewProps {
  diary: any;
  fichapdaDetail: any;
  pdaDiarioDetail: any;
  pdaDiarioPiles: any[];
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

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
  fichapdaDetail,
  pdaDiarioDetail,
  pdaDiarioPiles = [],
}) => {
  const ficha = fichapdaDetail || {};
  const pdaDiario = pdaDiarioDetail || {};
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA • PDA">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={pdaDiarioDetail?.pda_computadores ? (Array.isArray(pdaDiarioDetail.pda_computadores) ? pdaDiarioDetail.pda_computadores.join(', ') : pdaDiarioDetail.pda_computadores) : 'PDA'} />
        <PdfRow label="Início" value={diary.startTime || '-'} />
        <PdfRow label="Término" value={diary.endTime || '-'} />
        <PdfRow label="Equipe" value={diary.team} span={2} />
        <PdfRow label="Endereço" value={diary.address} span={5} />
      </PdfSection>

      <section className="border border-gray-400">
        <div className="bg-gray-200 border-b border-gray-400 px-0.5 py-0.5 font-bold uppercase text-[6px] flex items-center">
          Clima
        </div>
        <div className="px-0.5 py-1 flex items-center gap-4 text-[7px]">
          <PdfValue label="Ensolarado" checked={!!diary?.weather_ensolarado} />
          <PdfValue label="Chuva fraca" checked={!!diary?.weather_chuva_fraca} />
          <PdfValue label="Chuva forte" checked={!!diary?.weather_chuva_forte} />
        </div>
      </section>

      <PdfSection columns={4} title="Ficha técnica PDA">
        <PdfRow label="Computador" value={joinOrDash(fichapdaDetail?.computador)} />
        <PdfRow label="Estaca" value={fichapdaDetail?.estaca_nome || '-'} />
        <PdfRow label="Tipo" value={fichapdaDetail?.estaca_tipo || '-'} />
        <PdfRow label="Diâmetro (cm)" value={fichapdaDetail?.diametro_cm ?? '-'} />
        <PdfRow label="Bloco" value={fichapdaDetail?.bloco_nome || '-'} />
        <PdfRow label="Carga de trabalho (tf)" value={fichapdaDetail?.carga_trabalho_tf ?? '-'} />
        <PdfRow label="Carga de ensaio (tf)" value={fichapdaDetail?.carga_ensaio_tf ?? '-'} />
        <PdfRow label="Peso martelo (kg)" value={fichapdaDetail?.peso_martelo_kg ?? '-'} />
        <PdfRow label="LP (metros)" value={fichapdaDetail?.lp_m ?? '-'} />
        <PdfRow label="LE (metros)" value={fichapdaDetail?.le_m ?? '-'} />
        <PdfRow label="LT (metros)" value={fichapdaDetail?.lt_m ?? '-'} />
        <PdfRow label="Sensores (metros)" value={fichapdaDetail?.altura_sensores_m ?? '-'} />
        <PdfRow label="Hq" value={joinOrDash(fichapdaDetail?.hq)} span={2} />
        <PdfRow label="Nega" value={joinOrDash(fichapdaDetail?.nega)} span={2} />
      </PdfSection>

      <PdfSection columns={4} title="Operação PDA">
        <PdfRow label="Computadores" value={joinOrDash(pdaDiarioDetail?.pda_computadores)} span={2} />
        <PdfRow label="Horímetro" value={pdaDiarioDetail?.horimetro_horas ?? '-'} />
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
            <div className="flex gap-2">
              <PdfValue label="Sim" checked={pdaDiarioDetail?.entrega_chegou_diesel === true} />
              <PdfValue label="Não" checked={pdaDiarioDetail?.entrega_chegou_diesel === false} />
            </div>
          }
          span={2}
        />
        <PdfRow label="Fornecido por" value={pdaDiarioDetail?.entrega_fornecido_por || '-'} />
        <PdfRow label="Quantidade (L)" value={pdaDiarioDetail?.entrega_quantidade_litros ?? '-'} />
        <PdfRow label="Horário" value={pdaDiarioDetail?.entrega_horario_chegada || '-'} />
      </PdfSection>

      <section className="border border-gray-400 mb-1" data-pdf-section="estacas">
        <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 font-bold uppercase text-[7px]">
          Estacas
        </div>
        <div className="p-1.5">
          <PdfTable
            headers={['Estaca', 'Tipo', 'Diâmetro (cm)', 'Profundidade (metros)', 'Carga de trabalho (tf)', 'Carga de ensaio (tf)']}
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

      <PdfSection title="Assinaturas" columns={2}>
        <PdfRow
          label="Geoteste"
          value={<GeotestSignatureValue diary={diary} />}
        />
        <PdfRow label="Cliente" placeholder />
      </PdfSection>
    </PdfLayout>
  );
};
