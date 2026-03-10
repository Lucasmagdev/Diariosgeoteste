import React from 'react';
import { PdfLayout, PdfRow, PdfSection, PdfTable, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';

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
