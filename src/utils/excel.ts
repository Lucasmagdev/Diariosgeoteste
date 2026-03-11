import * as XLSX from 'xlsx';
import { formatTime24hOrEmpty } from './time';

export type DiaryExcelRow = {
  Tipo?: string;
  Cliente: string;
  Endereco: string;
  Equipe: string;
  Data: string;
  Inicio: string;
  Termino: string;
  'Serviços Executados': string;
  'Assinatura Geoteste': string;
  'Assinatura Responsável': string;
  Observações: string;
  'Criado em': string;
  [key: string]: any; // Permite campos dinâmicos para dados específicos
};

export function downloadExcel(fileName: string, rows: DiaryExcelRow[]): void {
  if (rows.length === 0) {
    alert('Não há dados para exportar');
    return;
  }

  // Criar uma nova planilha
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajustar largura das colunas dinamicamente
  const maxWidths: { [key: string]: number } = {};
  
  // Calcular largura máxima para cada coluna
  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      const value = String(row[key] || '');
      const width = Math.max(key.length, value.length);
      maxWidths[key] = Math.max(maxWidths[key] || 10, Math.min(width, 50));
    });
  });

  const columnWidths = Object.keys(rows[0]).map(key => ({ wch: maxWidths[key] || 15 }));
  worksheet['!cols'] = columnWidths;

  // Criar um novo workbook e adicionar a planilha
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Diários');

  // Gerar arquivo e fazer download
  const excelFileName = fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx';
  XLSX.writeFile(workbook, excelFileName);
}

export function mapDiaryToExcelRow(d: {
  type?: string;
  clientName: string;
  address: string;
  team: string;
  date: string;
  startTime: string;
  endTime: string;
  servicesExecuted: string;
  geotestSignature: string;
  responsibleSignature: string;
  observations?: string;
  createdAt: string;
  pceDetail?: any;
  pcePiles?: any[];
  pitDetail?: any;
  pitPiles?: any[];
  placaDetail?: any;
  placaPiles?: any[];
}): DiaryExcelRow {
  const baseRow: DiaryExcelRow = {
    Tipo: d.type ?? '',
    Cliente: d.clientName,
    Endereco: d.address,
    Equipe: d.team,
    Data: new Date(d.date).toLocaleDateString('pt-BR'),
    Inicio: formatTime24hOrEmpty(d.startTime),
    Termino: formatTime24hOrEmpty(d.endTime),
    'Serviços Executados': d.servicesExecuted,
    'Assinatura Geoteste': d.geotestSignature,
    'Assinatura Responsável': d.responsibleSignature,
    Observações: d.observations ?? '',
    'Criado em': new Date(d.createdAt).toLocaleDateString('pt-BR') + ' ' + new Date(d.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };

  // Adicionar dados específicos de PCE
  if (d.type === 'PCE' && d.pceDetail) {
    baseRow['PCE - Tipo de Ensaio'] = d.pceDetail.ensaio_tipo || '';
    baseRow['PCE - Tipos de Carregamento'] = d.pceDetail.carregamento_tipos?.join(', ') || '';
    baseRow['PCE - Macaco'] = d.pceDetail.equipamentos_macaco || '';
    baseRow['PCE - Célula'] = d.pceDetail.equipamentos_celula || '';
    baseRow['PCE - Manômetro'] = d.pceDetail.equipamentos_manometro || '';
    baseRow['PCE - Relógios'] = d.pceDetail.equipamentos_relogios || '';
    baseRow['PCE - Conjunto de Vigas'] = d.pceDetail.equipamentos_conjunto_vigas || '';
    baseRow['PCE - Ocorrências'] = d.pceDetail.ocorrencias || '';
    
    if (d.pceDetail.cravacao_equipamento) {
      baseRow['PCE - Equipamento de Cravação'] = d.pceDetail.cravacao_equipamento || '';
      baseRow['PCE - Horímetro'] = d.pceDetail.cravacao_horimetro || '';
    }
    
    if (d.pceDetail.abastecimento_chegou_diesel) {
      baseRow['PCE - Chegou Diesel'] = d.pceDetail.abastecimento_chegou_diesel || '';
      baseRow['PCE - Fornecido Por'] = d.pceDetail.abastecimento_fornecido_por || '';
      baseRow['PCE - Quantidade Litros'] = d.pceDetail.abastecimento_quantidade_litros || '';
    }

    if (d.pcePiles && d.pcePiles.length > 0) {
      baseRow['PCE - Estacas'] = d.pcePiles.map((p: any) => 
        `${p.nome}: ${p.profundidade_m}m, ${p.tipo}, ${p.carga_trabalho_tf}tf, Ø${p.diametro_cm}cm`
      ).join(' | ');
    }
  }

  // Adicionar dados específicos de PIT
  if (d.type === 'PIT' && d.pitDetail) {
    baseRow['PIT - Equipamento'] = d.pitDetail.equipamento || '';
    baseRow['PIT - Total de Estacas'] = d.pitDetail.total_estacas || '';
    baseRow['PIT - Ocorrências'] = d.pitDetail.ocorrencias || '';
    
    if (d.pitPiles && d.pitPiles.length > 0) {
      baseRow['PIT - Estacas'] = d.pitPiles.map((p: any) => 
        `${p.nome}: ${p.tipo}, Ø${p.diametro_cm}cm, Prof: ${p.profundidade_cm}cm, Arr: ${p.arrasamento_m}m, Útil: ${p.comprimento_util_m}m`
      ).join(' | ');
    }
  }

  // Adicionar dados específicos de PLACA
  if (d.type === 'PLACA' && d.placaDetail) {
    baseRow['PLACA - Macaco'] = d.placaDetail.equipamentos_macaco || '';
    baseRow['PLACA - Célula de Carga'] = d.placaDetail.equipamentos_celula_carga || '';
    baseRow['PLACA - Manômetro'] = d.placaDetail.equipamentos_manometro || '';
    baseRow['PLACA - Dimensões da Placa'] = d.placaDetail.equipamentos_placa_dimensoes || '';
    baseRow['PLACA - Equipamento de Reação'] = d.placaDetail.equipamentos_equipamento_reacao || '';
    baseRow['PLACA - Relógios'] = d.placaDetail.equipamentos_relogios || '';
    baseRow['PLACA - Ocorrências'] = d.placaDetail.ocorrencias || '';
    
    if (d.placaPiles && d.placaPiles.length > 0) {
      baseRow['PLACA - Pontos de Teste'] = d.placaPiles.map((p: any) => 
        `${p.nome}: ${p.carga_trabalho_1_kgf_cm2}kgf/cm² / ${p.carga_trabalho_2_kgf_cm2}kgf/cm²`
      ).join(' | ');
    }
  }

  return baseRow;
}

