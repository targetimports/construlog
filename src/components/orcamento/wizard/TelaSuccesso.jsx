import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, Home, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

// TelaSuccesso — fluxo simplificado:
// Se importResult já trouxer consolidado=true, mostrar diretamente verde.
// Só fazer polling se ainda estiver pendente.
export default function TelaSuccesso({ obraId, total_orcamento_confirmado, itensOrcamento = 0, importResult = null }) {
  const [obra, setObra] = React.useState(null);
  const [carregando, setCarregando] = React.useState(true);
  const [consolidado, setConsolidado] = React.useState(
    importResult?.consolidado === true && (importResult?.total_itens || 0) > 0
  );
  const [totalItens, setTotalItens] = React.useState(importResult?.total_itens || 0);
  const [erroConsolidacao, setErroConsolidacao] = React.useState(null);
  const [polling, setPolling] = React.useState(false);
  const pollingRef = React.useRef(null);

  // Carregar obra
  React.useEffect(() => {
    if (!obraId) return;
    base44.entities.Obra.get(obraId)
      .then(o => setObra(o))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [obraId]);

  // Se não veio consolidado=true do backend, fazer polling
  React.useEffect(() => {
    if (!obraId) return;
    // Já consolidado — não fazer polling
    if (consolidado) return;

    let mounted = true;
    const poll = async () => {
      try {
        const { data } = await base44.functions.invoke('getOrcamentoConsolidacaoStatus', { obraId });
        if (!mounted) return;
        if (data?.consolidado || (data?.total_itens > 0 && data?.processados >= data?.total_itens)) {
          setConsolidado(true);
          setTotalItens(data.total_itens);
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        } else if (data?.status === 'error' || data?.erro_fatal) {
          setErroConsolidacao(data?.erro_fatal || 'Erro na consolidação do orçamento');
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        } else {
          setTotalItens(data?.total_itens || 0);
        }
      } catch (_) {}
    };

    poll();
    pollingRef.current = setInterval(poll, 3000);
    setPolling(true);

    return () => {
      mounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [obraId, consolidado]);

  const recarregarManual = async () => {
    try {
      const { data } = await base44.functions.invoke('getOrcamentoConsolidacaoStatus', { obraId });
      if (data?.consolidado || (data?.total_itens > 0 && data?.processados >= data?.total_itens)) {
        setConsolidado(true);
        setTotalItens(data.total_itens);
        setErroConsolidacao(null);
      } else if (data?.erro_fatal) {
        setErroConsolidacao(data.erro_fatal);
      }
    } catch (_) {}
  };

  if (carregando) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Carregando dados da obra...</p>
      </div>
    );
  }

  if (!obra) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-screen space-y-8">
      {/* Ícone de Sucesso */}
      <div className={consolidado ? "animate-bounce" : ""}>
        {consolidado
          ? <CheckCircle2 className="w-24 h-24 text-green-600" />
          : erroConsolidacao
            ? <AlertTriangle className="w-24 h-24 text-red-500" />
            : <Loader2 className="w-24 h-24 text-amber-500 animate-spin" />
        }
      </div>

      {/* Título */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          {consolidado
            ? 'Obra Importada com Sucesso!'
            : erroConsolidacao
              ? 'Obra criada — erro na consolidação'
              : 'Obra criada. Consolidando orçamento...'}
        </h1>
        <p className={`text-xl font-semibold ${consolidado ? 'text-green-600' : erroConsolidacao ? 'text-red-600' : 'text-amber-600'}`}>
          {obra.nome}
        </p>
        {!consolidado && !erroConsolidacao && (
          <p className="text-gray-500 text-sm">Finalizando a consolidação dos itens do orçamento...</p>
        )}
        {erroConsolidacao && (
          <p className="text-red-600 text-sm">{erroConsolidacao}</p>
        )}
      </div>

      {/* Card resumo */}
      <Card className={`w-full border-2 ${consolidado ? 'border-green-200' : erroConsolidacao ? 'border-red-200' : 'border-amber-200'}`}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">ID da Obra:</span>
            <span className="font-mono font-semibold text-blue-600">{obra.id}</span>
          </div>

          <div className="flex justify-center">
            <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-xs font-bold">
              ✓ Importado OrçaFascio
            </span>
          </div>

          <div className="border-t border-gray-200 pt-4">
            {/* Status consolidação */}
            <div className={`rounded-lg p-4 border mb-3 ${consolidado ? 'bg-green-50 border-green-200' : erroConsolidacao ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {consolidado && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {!consolidado && !erroConsolidacao && <Loader2 className="w-4 h-4 animate-spin text-amber-600" />}
                  {erroConsolidacao && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <span className="text-sm font-medium">
                    {consolidado ? `Orçamento consolidado — ${totalItens} itens` : erroConsolidacao ? 'Erro na consolidação' : 'Consolidando orçamento...'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={recarregarManual} className="gap-1 text-xs">
                  <RefreshCcw className="w-3 h-3" /> Recarregar
                </Button>
              </div>
            </div>

            {/* Valor do orçamento */}
            {consolidado && (total_orcamento_confirmado || obra?.total_orcamento) > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Orçamento Importado (Sintético)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(total_orcamento_confirmado || obra.total_orcamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="w-full space-y-3">
        <Button
          className="w-full bg-green-600 hover:bg-green-700 h-12"
          onClick={() => window.location.href = createPageUrl(`ObraDetalhes?id=${obra.id}`)}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          Abrir Obra Agora
        </Button>
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => window.location.href = '/Obras'}
        >
          <Home className="w-4 h-4 mr-2" />
          Ver Todas as Obras
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center p-4 bg-gray-50 rounded-lg">
        <p>A obra foi importada com os dados da planilha OrçaFascio.</p>
        <p>Você pode editar qualquer informação no módulo de detalhes da obra.</p>
      </div>
    </div>
  );
}