import React from 'react';
import { PdfClimateRow, PdfLayout, PdfRow, PdfSection, PdfTable } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';
import { formatTime24h } from '../../utils/time';

interface PLACADiaryViewProps {
  diary: any;
  placaDetail: any;
  placaPiles: any[];
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

export const PLACADiaryView: React.FC<PLACADiaryViewProps> = ({ diary, placaDetail = {}, placaPiles = [] }) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA • PLACA">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={placaDetail.equipamentos_equipamento_reacao || 'PLACA'} />
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

      <PdfSection columns={4} title="Equipamentos">
        <PdfRow label="Macaco" value={placaDetail.equipamentos_macaco || '-'} />
        <PdfRow label="Célula" value={placaDetail.equipamentos_celula_carga || '-'} />
        <PdfRow label="Manômetro" value={placaDetail.equipamentos_manometro || '-'} />
        <PdfRow label="Placa" value={placaDetail.equipamentos_placa_dimensoes || '-'} />
        <PdfRow label="Reação" value={placaDetail.equipamentos_equipamento_reacao || '-'} />
        <PdfRow label="Relógios" value={placaDetail.equipamentos_relogios || '-'} />
      </PdfSection>

      <section className="border border-gray-400 mb-1" data-pdf-section="estacas">
        <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 font-bold uppercase text-[7px]">
          Pontos
        </div>
        <div className="p-1.5">
          <PdfTable
            headers={['Ponto', 'Carga 1 (kgf/cm²)', 'Carga 2 (kgf/cm²)']}
            rows={placaPiles.map((point) => [
              point.nome || '-',
              point.carga_trabalho_1_kgf_cm2 || '-',
              point.carga_trabalho_2_kgf_cm2 || '-',
            ])}
          />
        </div>
      </section>

      <PdfSection title="Ocorrências">
        <PdfRow label="Descrição" value={placaDetail.ocorrencias || diary.observations || '-'} span={3} />
      </PdfSection>

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
