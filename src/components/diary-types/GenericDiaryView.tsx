import React from 'react';
import { PdfLayout, PdfRow, PdfSection, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';

interface GenericDiaryViewProps {
  diary: any;
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

export const GenericDiaryView: React.FC<GenericDiaryViewProps> = ({ diary }) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={diary.equipment || '-'} />
        <PdfRow label="Início" value={diary.startTime || '-'} />
        <PdfRow label="Término" value={diary.endTime || '-'} />
        <PdfRow label="Equipe" value={diary.team} span={2} />
        <PdfRow label="Endereço" value={diary.address} span={3} />
        <PdfRow label="Obra" value={diary.projectName || '-'} span={2} />
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

      <PdfSection title="Ocorrências">
        <PdfRow label="Descrição" value={diary.occurrences || diary.observations || '-'} span={3} />
      </PdfSection>

      <PdfSection title="Abastecimento" columns={4}>
        <PdfRow label="Diesel?" value={<PdfValue label="Sim" checked={diary.dieselArrived} />} />
        <PdfRow label="" value={<PdfValue label="Não" checked={diary.dieselArrived === false} />} />
        <PdfRow label="Fornecido por" value={diary.suppliedBy || '-'} />
        <PdfRow label="Litros" value={diary.dieselLiters || '-'} />
        <PdfRow label="Horário" value={diary.dieselArrival || '-'} />
        <PdfRow label="Observações" value={diary.dieselObservation || '-'} span={3} />
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
