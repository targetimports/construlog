import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PCNotaFiscalConferencia from './PCNotaFiscalConferencia';

const STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: null },
  PROCESSANDO: { label: 'Processando...', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  PROCESSADO: { label: 'Processado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  PROCESSADO_COM_PENDENCIAS: { label: 'Processado (com pendências)', color: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  ERRO: { label: 'Erro na leitura', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

export default function PCNotaFiscalLeitura({
  anexo,
  pedidoId,
  pedidoData = null,
  onDadosExtraidos = null,
  onReprocessar = null,
  onAplicarNF = null,
}) {
  const [leitura, setLeitura] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const [mostrando, setMostrando] = useState('resumo'); // 'resumo' | 'conferencia'

  const lerMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('lerNotaFiscalPedidoCompra', {
        anexoId: anexo.id,
        arquivo: anexo.conteudo || null,
        tipoArquivo: anexo.tipo_arquivo || anexo.tipo || '',
        nomeOriginal: anexo.nome_original || anexo.nome || '',
        url: anexo.url || anexo.arquivo_url || '',
      });
      return response.data;
    },
    onSuccess: (dados) => {
      setLeitura(dados);
      if (onDadosExtraidos) onDadosExtraidos(dados);
      if (dados.status !== 'ERRO') {
        toast.success('Nota Fiscal lida com sucesso');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.erro || err?.message || 'Erro desconhecido';
      setLeitura({
        sucesso: false,
        status: 'ERRO',
        erro: msg,
      });
      toast.error(`Erro ao ler NF: ${msg}`);
    },
  });

  // Iniciar leitura quando anexo mudar
  useEffect(() => {
    if (anexo && !leitura) {
      lerMutation.mutate();
    }
  }, [anexo?.id]);

  if (!leitura) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm text-blue-700">Lendo Nota Fiscal...</span>
      </div>
    );
  }

  const { status, dadosExtraidos, erro } = leitura;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ERRO;
  const Icon = config.icon;

  if (!leitura.sucesso || status === 'ERRO') {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">Erro ao ler Nota Fiscal</p>
            <p className="text-xs text-red-700 mt-1">{erro || 'Erro desconhecido'}</p>
          </div>
          {onReprocessar && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLeitura(null);
                lerMutation.mutate();
              }}
              disabled={lerMutation.isPending}
              className="flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border rounded-lg ${config.color}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          <div>
            <p className="text-sm font-semibold">Dados Extraídos da NF</p>
            <p className="text-xs opacity-75">
              {dadosExtraidos?.tipo === 'nfe' ? 'XML NF-e (estruturado)' : 'PDF/Imagem (IA/OCR)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={config.color}>{config.label}</Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandido(!expandido)}
            className="h-7 w-7 p-0"
          >
            <Eye className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Dados extraídos (collapsible) */}
      {expandido && (
        <div className="mt-3 space-y-3 bg-white/50 p-3 rounded text-xs">
          {/* Cabeçalho */}
          {dadosExtraidos?.cabecalho && (
            <div className="space-y-1">
              <p className="font-semibold text-gray-700">Cabeçalho</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Número', dadosExtraidos.cabecalho.numero],
                  ['Série', dadosExtraidos.cabecalho.serie],
                  ['Chave', dadosExtraidos.cabecalho.chave_acesso?.slice(0, 10) + '...'],
                  ['Data', dadosExtraidos.cabecalho.data_emissao],
                  ['Fornecedor', dadosExtraidos.cabecalho.fornecedor_nome],
                  ['CNPJ', dadosExtraidos.cabecalho.fornecedor_cnpj],
                  ['Total', `R$ ${dadosExtraidos.cabecalho.valor_total?.toFixed(2)}`],
                ].map(([label, valor]) => (
                  <div key={label}>
                    <p className="text-gray-600">{label}</p>
                    <p className="font-medium text-gray-900 truncate">{valor || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itens */}
          {dadosExtraidos?.itens && dadosExtraidos.itens.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-gray-700">Itens ({dadosExtraidos.itens.length})</p>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {dadosExtraidos.itens.map((item, idx) => (
                  <div key={idx} className="bg-white p-2 rounded border border-gray-200">
                    <p className="font-medium text-gray-900">{item.descricao || '—'}</p>
                    <div className="grid grid-cols-3 gap-1 mt-1 text-gray-600">
                      <span>{item.quantidade} {item.unidade}</span>
                      <span>R$ {item.valor_unitario?.toFixed(2)}</span>
                      <span className="font-medium">R$ {item.valor_total?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendências */}
          {leitura.dadosExtraidos?.pendencias && leitura.dadosExtraidos.pendencias.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-2 rounded">
              <p className="font-semibold text-amber-800 mb-1">Pendências</p>
              <ul className="text-amber-700 space-y-0.5">
                {leitura.dadosExtraidos.pendencias.map((pend, idx) => (
                  <li key={idx} className="flex gap-1">
                    <span>•</span> {pend}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confiança geral */}
          {dadosExtraidos?.confianca_geral && (
            <div className="flex items-center gap-2">
              <p className="text-gray-600">Confiança geral:</p>
              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${dadosExtraidos.confianca_geral * 100}%` }}
                />
              </div>
              <span className="font-medium text-gray-700">{(dadosExtraidos.confianca_geral * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Tela de Conferência */}
      {mostrando === 'conferencia' && pedidoData && (
        <PCNotaFiscalConferencia
          pedidoId={pedidoId}
          pedidoData={pedidoData}
          dadosNF={dadosExtraidos}
          onConfirmar={(resultado) => {
            setMostrando('resumo');
            toast.success('Dados da NF aplicados com sucesso ao pedido');
            if (onAplicarNF) onAplicarNF(resultado);
          }}
          onCancelar={() => setMostrando('resumo')}
        />
      )}

      {/* Actions */}
      {mostrando === 'resumo' && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLeitura(null);
              lerMutation.mutate();
            }}
            disabled={lerMutation.isPending}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reprocessar
          </Button>
          {dadosExtraidos && pedidoData && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setMostrando('conferencia')}
            >
              Aplicar ao pedido
            </Button>
          )}
          {dadosExtraidos && !pedidoData && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (onDadosExtraidos) onDadosExtraidos(dadosExtraidos);
                toast.success('Dados prontos para revisão');
              }}
            >
              Usar dados extraídos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}