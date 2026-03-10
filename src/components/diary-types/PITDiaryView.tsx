import React from 'react';
import { PdfLayout, PdfRow, PdfSection, PdfTable, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';

interface PITDiaryViewProps {
  diary: any;
  pitDetail: any;
  pitPiles: any[];
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

export const PITDiaryView: React.FC<PITDiaryViewProps> = ({ diary, pitDetail = {}, pitPiles = [] }) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA • PIT">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={pitDetail.equipamento || 'PIT'} />
        <PdfRow label="Início" value={diary.startTime || '-'} />
        <PdfRow label="Término" value={diary.endTime || '-'} />
        <PdfRow label="Equipe" value={diary.team} span={2} />
        <PdfRow label="Endereço" value={diary.address} span={5} />
      </PdfSection>

      <section className="border border-gray-400">
        <div className="bg-gray-200 border-b border-gray-400 px-0.5 py-0.5 font-bold uppercase text-[6px] flex items-center">
          Clima
        </div>
        <div className="px-0.5 py-1 flex items-center gap-4 text-[7px]" style={{ alignItems: 'center', display: 'flex' }}>
          <PdfValue label="Ensolarado" checked={!!diary?.weather_ensolarado} />
          <PdfValue label="Chuva fraca" checked={!!diary?.weather_chuva_fraca} />
          <PdfValue label="Chuva forte" checked={!!diary?.weather_chuva_forte} />
        </div>
      </section>

      <PdfSection columns={4} title="Dados do ensaio">
        <PdfRow label="Total estacas" value={pitDetail.total_estacas || '-'} />
        <PdfRow label="Estacas ensaiadas" value={pitDetail.estacas_ensaiadas || '-'} />
        <PdfRow label="Horímetro" value={pitDetail.horimetro || '-'} span={2} />
        <PdfRow label="Ocorrências" value={pitDetail.ocorrencias || diary.observations || '-'} span={4} />
      </PdfSection>

      <section className="border border-gray-400 mb-1" data-pdf-section="estacas">
        <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 font-bold uppercase text-[7px]">
          Estacas
        </div>
        <div className="p-1.5">
          <PdfTable
            headers={[
              'Estaca',
              'Tipo',
              'Diâmetro (cm)',
              'Profundidade (cm)',
              'Arrasamento (m)',
              'Comprimento útil (m)',
            ]}
            rows={pitPiles.map((pile) => [
              pile.estaca_nome || '-',
              pile.estaca_tipo || '-',
              pile.diametro_cm || '-',
              pile.profundidade_cm || '-',
              pile.arrasamento_m || '-',
              pile.comprimento_util_m || '-',
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
