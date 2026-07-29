import React, { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import PlayerVideo from '@/components/shared/PlayerVideo';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Play, ChevronRight } from 'lucide-react';

// CENTRAL DE AJUDA — as aulas em ziguezague, como um caminho a percorrer.
//
// Layout: uma linha vertical no centro liga as etapas; o vídeo fica de um lado e o
// texto do outro, alternando a cada aula. No celular tudo empilha numa coluna só.
//
// Conteúdo deliberadamente enxuto: título, uma frase e onde fica. O passo a passo
// abre sob demanda, para a página não virar um paredão de texto.
//
// Os vídeos são servidos pelo próprio servidor em /videos/ (nginx, com range
// request para arrastar a barra). Trocar um vídeo é substituir o arquivo em
// /root/construlog/videos — não exige rebuild.

const AULAS = [
  {
    n: 1,
    id: 'criar-obra',
    titulo: 'Criar a obra',
    duracao: '3:09',
    arquivo: '01-criar-obra-orcafacil.mp4',
    resumo: 'Importe a planilha do OrçaFácil e tenha obra, orçamento e cronograma criados de uma vez.',
    onde: 'Obras › Importar OrçaFácil',
    passos: [
      'Envie a planilha do orçamento (.xlsx) ou o PDF.',
      'Confira os totais e a lista de itens.',
      'Preencha os dados da obra e os responsáveis.',
      'Revise e finalize.',
    ],
  },
  {
    n: 2,
    id: 'iniciar-obra',
    titulo: 'Iniciar a obra',
    duracao: '1:51',
    arquivo: '02-primeira-requisicao-e-custo.mp4',
    resumo: 'Lance o recebimento e o custo previstos — é o que coloca a obra Em Andamento.',
    onde: 'Obra › Financeiro',
    passos: [
      'Abra a obra na aba Financeiro.',
      'Em Recebimentos, lance o primeiro recebimento previsto.',
      'Em Custos Previstos, lance o custo previsto.',
      'Mude o status da obra para Em Andamento.',
    ],
  },
  {
    n: 3,
    id: 'cronograma',
    titulo: 'Cronograma',
    duracao: '1:12',
    arquivo: '03-cronograma.mp4',
    resumo: 'Planeje as atividades e acompanhe o avanço no Gantt.',
    onde: 'Obra › Cronograma',
    passos: [
      'Cadastre as atividades.',
      'Informe início e duração — o fim é calculado.',
      'Atualize o percentual executado.',
    ],
  },
  {
    n: 4,
    id: 'contrato-medicoes',
    titulo: 'Contrato e medições',
    duracao: '3:05',
    arquivo: '04-contrato-e-medicoes.mp4',
    resumo: 'O caminho do faturamento: gerar o contrato e medir o que foi executado.',
    onde: 'Obra › Medições',
    passos: [
      'Gere o contrato a partir do orçamento.',
      'Crie o Boletim de Medição.',
      'Informe o acumulado de cada item.',
      'Aprove — a conta a receber é gerada.',
    ],
  },
  {
    n: 5,
    id: 'requisicao-material',
    titulo: 'Requisição de material',
    duracao: '1:58',
    arquivo: '05-requisicao-material-recebimento.mp4',
    resumo: 'Pedir, aprovar, receber e vistoriar o material que já existe no estoque.',
    onde: 'Estoque › Requisições de Material',
    passos: [
      'A obra pede os itens.',
      'A Central aprova e envia.',
      'A obra confere o que chegou, com fotos.',
    ],
  },
  {
    n: 6,
    id: 'compra',
    titulo: 'Compra de material',
    duracao: '1:37',
    arquivo: '06-compra-pedido-recebimento.mp4',
    resumo: 'Quando não há em estoque: solicitação, pedido ao fornecedor e recebimento na obra.',
    onde: 'Compras › Solicitações › Pedidos',
    passos: [
      'A obra registra a solicitação.',
      'A Central converte em pedido e confirma a compra.',
      'A obra recebe e vistoria.',
    ],
  },
  {
    n: 7,
    id: 'emprestimo-ativo',
    titulo: 'Veículos e máquinas',
    duracao: '2:22',
    arquivo: '07-emprestimo-ativo-os-vistoria.mp4',
    resumo: 'Empréstimo com vistoria, Ordem de Serviço assinada e devolução.',
    onde: 'Logística & Frota › Empréstimo de Ativos',
    passos: [
      'A obra solicita o equipamento.',
      'Vistoria de saída com fotos e assinatura.',
      'Liberação emite a O.S.',
      'Vistoria de devolução ao voltar.',
    ],
  },
  {
    n: 8,
    id: 'equipe',
    titulo: 'Equipe e diário',
    duracao: '2:33',
    arquivo: '08-diario-ponto-equipe.mp4',
    resumo: 'A rotina que alimenta a folha, o custo de mão de obra e o histórico da obra.',
    onde: 'Obra › Equipe & Diário',
    passos: [
      'Registre o diário do dia.',
      'Marque a presença da equipe.',
      'Aprove as diárias do dia.',
      'Aloque ou transfira colaboradores.',
    ],
  },
];

function Video({ aula, onExpandir }) {
  const [iniciado, setIniciado] = useState(false);

  // Antes do play só existe a capa: oito players carregando metadados de 230 MB
  // ao abrir a página seria desperdício de banda de quem só quer ler.
  if (!iniciado) {
    return (
      <button
        type="button"
        onClick={() => setIniciado(true)}
        className="group relative w-full aspect-video rounded-xl border border-gray-200 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 text-blue-600 ml-1" fill="currentColor" />
          </span>
        </span>
        <span className="absolute bottom-3 right-3 text-[11px] font-medium text-white/90 bg-black/40 rounded px-1.5 py-0.5 tabular-nums">
          {aula.duracao}
        </span>
      </button>
    );
  }

  return (
    <PlayerVideo
      src={`/videos/${aula.arquivo}`}
      autoPlay
      onExpandir={(segundos) => onExpandir(aula, segundos)}
      className="shadow-sm"
    />
  );
}

function Texto({ aula, alinharDireita }) {
  const [verPassos, setVerPassos] = useState(false);
  return (
    <div className={alinharDireita ? 'md:text-right' : ''}>
      <p className="text-xs font-semibold text-blue-600 tracking-wide">AULA {aula.n}</p>
      <h3 className="text-lg font-semibold text-gray-900 mt-1">{aula.titulo}</h3>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{aula.resumo}</p>
      <p className="text-xs text-gray-400 mt-2">{aula.onde}</p>

      <button
        type="button"
        onClick={() => setVerPassos((v) => !v)}
        className={`mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 ${alinharDireita ? 'md:flex-row-reverse' : ''}`}
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${verPassos ? 'rotate-90' : ''}`} />
        {verPassos ? 'ocultar passos' : 'ver passos'}
      </button>

      {verPassos && (
        <ol className={`mt-2 space-y-1 text-sm text-gray-600 ${alinharDireita ? 'md:list-none' : 'list-decimal pl-5'}`}>
          {aula.passos.map((p, i) => (
            <li key={i}>{alinharDireita && <span className="hidden md:inline text-gray-400">{i + 1}. </span>}{p}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Ajuda() {
  // Vídeo ampliado: guarda a aula e o ponto em que estava, para continuar de onde parou.
  const [ampliado, setAmpliado] = useState(null);

  return (
    <div className="pb-12">
      <PageHeader
        title="Central de Ajuda"
        subtitle="O caminho de uma obra, em oito vídeos curtos"
      />

      <div className="relative mt-10 max-w-4xl mx-auto">
        {/* A linha que liga as etapas. Só no desktop: no celular a leitura já é
            vertical por natureza e a linha viraria ruído. */}
        <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-gray-200 -translate-x-1/2" />

        <div className="space-y-12 md:space-y-16">
          {AULAS.map((aula, i) => {
            const videoNaEsquerda = i % 2 === 0;
            return (
              <div key={aula.id} className="relative md:grid md:grid-cols-2 md:gap-12 md:items-center">
                {/* Marcador na linha central */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-blue-500 items-center justify-center z-10">
                  <span className="text-xs font-bold text-blue-600 tabular-nums">{aula.n}</span>
                </div>

                {videoNaEsquerda ? (
                  <>
                    <div className="md:pr-4"><Video aula={aula} onExpandir={(a, s) => setAmpliado({ aula: a, segundos: s })} /></div>
                    <div className="mt-4 md:mt-0 md:pl-4"><Texto aula={aula} /></div>
                  </>
                ) : (
                  <>
                    {/* No desktop o texto vem primeiro (coluna da esquerda); no
                        celular a ordem visual é sempre vídeo → texto. */}
                    <div className="hidden md:block md:pr-4"><Texto aula={aula} alinharDireita /></div>
                    <div className="md:pl-4"><Video aula={aula} onExpandir={(a, s) => setAmpliado({ aula: a, segundos: s })} /></div>
                    <div className="mt-4 md:hidden"><Texto aula={aula} /></div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vídeo ampliado. No desktop ocupa 70% da tela; no celular 70% seria pequeno
          demais, então usa a largura toda como os outros modais do sistema. */}
      <Dialog open={!!ampliado} onOpenChange={(v) => { if (!v) setAmpliado(null); }}>
        <DialogContent className="w-[95vw] md:w-[70vw] max-w-[95vw] md:max-w-[70vw] p-0 border-0 bg-transparent shadow-none">
          <DialogTitle className="sr-only">{ampliado?.aula?.titulo || 'Vídeo'}</DialogTitle>
          {ampliado && (
            <div>
              <PlayerVideo
                src={`/videos/${ampliado.aula.arquivo}`}
                autoPlay
                iniciarEm={ampliado.segundos}
                className="border-0 shadow-2xl"
              />
              <p className="text-sm font-medium text-white mt-3 px-1">
                <span className="text-white/60">Aula {ampliado.aula.n} — </span>
                {ampliado.aula.titulo}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
