import React from 'react';
import { PdfClimateRow, PdfLayout, PdfRow, PdfSection, PdfTable, PdfValue } from './PdfLayout';
import { GeotestSignatureValue } from './GeotestSignatureValue';
import { formatTime24h } from '../../utils/time';

interface PCEDiaryViewProps {
  diary: any;
  pceDetail: any;
  pcePiles: any[];
}

export const PCEDiaryView: React.FC<PCEDiaryViewProps> = ({ diary, pceDetail = {}, pcePiles = [] }) => {
  return (
    <PdfLayout diary={diary} title="DIÁRIO DE OBRA • PCE">
      <PdfSection columns={5} title="Identificação">
        <PdfRow label="Equipamento" value={pceDetail.cravacao_equipamento || 'PCE'} />
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

      <PdfSection columns={4} title="Dados do ensaio">
        <PdfRow label="Tipo" value={pceDetail.ensaio_tipo || '-'} span={2} />
        <PdfRow
          label="Carregamento"
          value={Array.isArray(pceDetail.carregamento_tipos) && pceDetail.carregamento_tipos.length > 0 ? pceDetail.carregamento_tipos.join(', ') : '-'}
          span={2}
        />
        <PdfRow label="Macaco" value={pceDetail.equipamentos_macaco || '-'} />
        <PdfRow
          label={pceDetail.ensaio_tipo === 'PCE HELICOIDAL' ? 'Célula de carga' : 'Célula'}
          value={pceDetail.equipamentos_celula || '-'}
        />
        <PdfRow label="Manômetro" value={pceDetail.equipamentos_manometro || '-'} />
        <PdfRow label="Relógios" value={pceDetail.equipamentos_relogios || '-'} />
        <PdfRow label="Vigas" value={pceDetail.equipamentos_conjunto_vigas || '-'} span={4} />
      </PdfSection>

      <section className="border border-gray-400 mb-1" data-pdf-section="estacas">
        <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 font-bold uppercase text-[7px]">
          Estacas
        </div>
        <div className="p-1.5">
          <PdfTable
            headers={
              pceDetail.ensaio_tipo === 'PCE HELICOIDAL'
                ? [
                    'Estaca',
                    'Tipo',
                    'Profundidade (metros)',
                    'Carga de trabalho (tf)',
                    'Carga de ensaio (tf)',
                    'Diâmetro (cm)',
                  ]
                : [
                    'Estaca',
                    'Tipo',
                    'Profundidade (metros)',
                    'Carga (tf)',
                    'Diâmetro (cm)',
                  ]
            }
            columnWidths={pceDetail.ensaio_tipo === 'PCE HELICOIDAL' ? '0.9fr 0.9fr 1.2fr 1.2fr 1.2fr 1fr' : '1fr 0.9fr 1.3fr 1fr 1fr'}
            compactHeaders
            rows={pcePiles.map((pile) => {
              if (pceDetail.ensaio_tipo === 'PCE HELICOIDAL') {
                return [
                  pile.estaca_nome || '-',
                  pile.estaca_tipo || '-',
                  pile.estaca_profundidade_m || '-',
                  pile.estaca_carga_trabalho_tf || '-',
                  pile.estaca_carga_ensaio_tf || '-',
                  pile.estaca_diametro_cm || '-',
                ];
              }

              return [
                pile.estaca_nome || '-',
                pile.estaca_tipo || '-',
                pile.estaca_profundidade_m || '-',
                pile.estaca_carga_trabalho_tf || '-',
                pile.estaca_diametro_cm || '-',
              ];
            })}
          />
        </div>
      </section>

      <PdfSection title="Ocorrências">
        <PdfRow label="Descrição" value={pceDetail.ocorrencias || diary.observations || '-'} span={3} />
      </PdfSection>

      {pceDetail.ensaio_tipo === 'PCE HELICOIDAL' && (
        <PdfSection columns={3} title="Cravação">
          <PdfRow label="Equipamento" value={pceDetail.cravacao_equipamento || '-'} span={2} />
          <PdfRow label="Horímetro" value={pceDetail.cravacao_horimetro || '-'} />
        </PdfSection>
      )}

      {pceDetail.ensaio_tipo === 'PCE HELICOIDAL' && (
        <PdfSection columns={4} title="Abastecimento">
          <PdfRow label="Mobilização Tanque (L)" value={pceDetail.abastecimento_mobilizacao_litros_tanque ?? '-'} />
          <PdfRow label="Mobilização Galão (L)" value={pceDetail.abastecimento_mobilizacao_litros_galao ?? '-'} />
          <PdfRow label="Final Tanque (L)" value={pceDetail.abastecimento_finaldia_litros_tanque ?? '-'} />
          <PdfRow label="Final Galão (L)" value={pceDetail.abastecimento_finaldia_litros_galao ?? '-'} />
          <PdfRow
            label="Diesel?"
            value={
              <div className="flex gap-2">
                <PdfValue label="Sim" checked={pceDetail.abastecimento_chegou_diesel === true} />
                <PdfValue label="Não" checked={pceDetail.abastecimento_chegou_diesel === false} />
              </div>
            }
            span={2}
          />
          <PdfRow label="Fornecido por" value={pceDetail.abastecimento_fornecido_por || '-'} />
          <PdfRow label="Quantidade (L)" value={pceDetail.abastecimento_quantidade_litros ?? '-'} />
          <PdfRow label="Horário" value={formatTime24h(pceDetail.abastecimento_horario_chegada)} />
        </PdfSection>
      )}

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
