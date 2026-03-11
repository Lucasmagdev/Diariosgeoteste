import React from 'react';
import { PdfClimateRow, PdfLayout, PdfRow, PdfSection, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';
import { ClientSignatureValue } from './ClientSignatureValue';
import { formatTime24h } from '../../utils/time';

interface GenericDiaryViewProps {
  diary: any;
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

export const GenericDiaryView: React.FC<GenericDiaryViewProps> = ({ diary }) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={diary.equipment || '-'} />
        <PdfRow label="Início" value={formatTime24h(diary.startTime)} />
        <PdfRow label="Término" value={formatTime24h(diary.endTime)} />
        <PdfRow label="Equipe" value={diary.team} span={2} />
        <PdfRow label="Endereço" value={diary.address} span={3} />
        <PdfRow label="Obra" value={diary.projectName || '-'} span={2} />
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

      <PdfSection title="Ocorrências">
        <PdfRow label="Descrição" value={diary.occurrences || diary.observations || '-'} span={3} />
      </PdfSection>

      <PdfSection title="Abastecimento" columns={4}>
        <PdfRow label="Diesel?" value={<PdfValue label="Sim" checked={diary.dieselArrived} />} />
        <PdfRow label="" value={<PdfValue label="Não" checked={diary.dieselArrived === false} />} />
        <PdfRow label="Fornecido por" value={diary.suppliedBy || '-'} />
        <PdfRow label="Litros" value={diary.dieselLiters || '-'} />
        <PdfRow label="Horário" value={formatTime24h(diary.dieselArrival)} />
        <PdfRow label="Observações" value={diary.dieselObservation || '-'} span={3} />
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
