import React, { useState } from 'react';
import { HelpCircle, X, CheckCircle2, ChevronDown } from 'lucide-react';

type Tab = 'passos' | 'duvidas';

const steps: Array<{ title: string; text: string }> = [
  {
    title: '1. Abra um novo Diário',
    text: 'No menu, toque em "Novo Diário". Em seguida, escolha o tipo de registro (PCE, PLACA, PIT, Ficha PDA ou PDA).',
  },
  {
    title: '2. Preencha os dados gerais',
    text: 'Informe o Cliente, a Data, os horários de Início e Término, a Equipe e o Endereço da obra. No celular, cada item abre em uma tela própria — basta tocar e preencher.',
  },
  {
    title: '3. Marque as condições climáticas',
    text: 'Selecione Ensolarado, Chuva fraca ou Chuva forte conforme o dia. É possível marcar mais de uma opção.',
  },
  {
    title: '4. Complete o formulário do tipo escolhido',
    text: 'Preencha os campos específicos do ensaio (equipamentos, estacas/pontos, ocorrências e abastecimento, quando houver). Adicione quantas estacas precisar.',
  },
  {
    title: '5. Salve o Diário',
    text: 'Revise as informações e toque em "Salvar". O registro fica disponível na lista de Diários.',
  },
  {
    title: '6. Gere o PDF e o link de assinatura',
    text: 'Abra o diário na lista e use "Exportar PDF" para baixar o documento, ou "Link Assinatura" para enviar ao cliente assinar à distância.',
  },
];

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Os campos com * são obrigatórios?',
    a: 'Sim. Cliente, Data, horários, Equipe e Endereço (Estado, Cidade, Rua e Número) precisam estar preenchidos para salvar.',
  },
  {
    q: 'A cidade não aparece na lista. E agora?',
    a: 'Você pode selecionar a cidade na lista OU simplesmente digitá-la no campo "Ou digite a cidade". Um dos dois já é suficiente.',
  },
  {
    q: 'Como preencho as assinaturas?',
    a: 'As assinaturas são feitas fora do sistema (GOV.BR). O PDF traz os espaços em branco e você pode gerar um "Link Assinatura" para o cliente assinar pelo navegador.',
  },
  {
    q: 'Posso adicionar mais de uma estaca ou ponto?',
    a: 'Sim. Dentro do formulário do tipo escolhido, use o botão de adicionar para incluir quantas estacas/pontos forem necessárias.',
  },
  {
    q: 'Onde encontro um diário já criado?',
    a: 'Na lista de Diários. Use a busca e os filtros por data, cliente ou tipo para localizar rapidamente.',
  },
  {
    q: 'Esqueci de marcar o clima ou um equipamento. Dá para corrigir?',
    a: 'Confira tudo antes de salvar. Use os indicadores de seção concluída como guia para não esquecer nenhum item.',
  },
];

export const DiaryHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('passos');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* Botão flutuante – mesma área do assistente, logo acima dele */}
      <div className="fixed right-4 bottom-36 md:bottom-20 z-[60]">
        {!open && (
          <div className="absolute right-16 bottom-2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap hidden sm:block">
            Dúvidas sobre o Diário?
            <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
          </div>
        )}

        <button
          onClick={() => setOpen(!open)}
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all duration-200 group min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          title="Dúvidas sobre o Diário"
        >
          {open ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />}
        </button>
      </div>

      {open && (
        <div className="fixed right-2 sm:right-4 bottom-24 sm:bottom-36 md:bottom-36 z-[60] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-md max-h-[70vh] sm:max-h-[80vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Dúvidas sobre o Diário</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <button
              onClick={() => setTab('passos')}
              className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'passos' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              Passo a passo
            </button>
            <button
              onClick={() => setTab('duvidas')}
              className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'duvidas' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              Dúvidas frequentes
            </button>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto">
            {tab === 'passos' ? (
              <ol className="space-y-3">
                {steps.map((step) => (
                  <li key={step.title} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="space-y-2">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={faq.q} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3">
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-3">
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                <strong>Dica:</strong> preencha as seções na ordem em que aparecem e confira tudo antes de salvar.
                Assim o seu Diário fica completo e pronto para gerar o PDF.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
