import React, { useState } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Paperclip, ArrowDownCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BaixaContaReceberModal from './BaixaContaReceberModal';

const statusConfig = {
  aberto: { label: 'Aberto', cls: 'bg-blue-100 text-blue-700' },
  parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700' },
  recebido: { label: 'Recebido', cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' }
};

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContasReceberObra({ obraId }) {
  const queryClient = useQueryClient();
  const [baixaConta, setBaixaConta] = useState(null);

  const { data: contas = [], isLoading, refetch } = useQuery({
    queryKey: ['contas-receber-obra', obraId],
    queryFn: () => base44.entities.ContaReceberObra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const podeDarBaixa = user?.role === 'admin' || ['financeiro', 'diretoria', 'programador'].includes(user?.perfil_acesso);

  async function handleCancelar(conta) {
    await base44.entities.ContaReceberObra.update(conta.id, { status: 'cancelado' });
    toast.success('Conta cancelada.');
    refetch();
    queryClient.invalidateQueries(['contas-receber-obra', obraId]);
  }

  // Totalizadores
  const ativas = contas.filter(c => c.status !== 'cancelado');
  const totalOriginal = ativas.reduce((a, c) => a + (c.valor_original || 0), 0);
  const totalRecebido = ativas.reduce((a, c) => a + (c.valor_recebido || 0), 0);
  const totalAberto = totalOriginal - totalRecebido;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Contas a Receber
        </h2>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Total a Receber</p>
          <p className="font-bold text-gray-900 text-sm">{fmt(totalOriginal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Recebido</p>
          <p className="font-bold text-green-700 text-sm">{fmt(totalRecebido)}</p>
        </div>
        <div className={`border rounded-lg p-3 text-center ${totalAberto > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Em Aberto</p>
          <p className={`font-bold text-sm ${totalAberto > 0 ? 'text-blue-700' : 'text-green-700'}`}>{fmt(totalAberto)}</p>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : contas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma conta a receber gerada.</p>
            <p className="text-gray-400 text-xs mt-1">Aprove medições e clique em "Gerar Conta a Receber".</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Recebido</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Origem</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Anexos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contas.map(c => {
                    const st = statusConfig[c.status] || statusConfig.aberto;
                    const saldo = (c.valor_original || 0) - (c.valor_recebido || 0);
                    const vencido = c.status === 'aberto' && c.data_vencimento && new Date(c.data_vencimento) < new Date();
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{c.descricao}</td>
                        <td className={`px-4 py-3 ${vencido ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString('pt-BR') : '—'}
                          {vencido && <span className="ml-1 text-xs">(vencido)</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.valor_original)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(c.valor_recebido)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt(saldo)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${st.cls}`}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {c.origem_tipo === 'MedicaoContrato' ? 'Medição' : c.origem_tipo}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {c.anexo_boletim_url && (
                              <a href={c.anexo_boletim_url} target="_blank" rel="noreferrer" title="Boletim" className="text-blue-500 hover:text-blue-700">
                                <Paperclip className="w-4 h-4" />
                              </a>
                            )}
                            {c.anexo_nota_fiscal_url && (
                              <a href={c.anexo_nota_fiscal_url} target="_blank" rel="noreferrer" title="Nota Fiscal" className="text-green-500 hover:text-green-700">
                                <Paperclip className="w-4 h-4" />
                              </a>
                            )}
                            {c.comprovante_url && (
                              <a href={c.comprovante_url} target="_blank" rel="noreferrer" title="Comprovante" className="text-purple-500 hover:text-purple-700">
                                <Paperclip className="w-4 h-4" />
                              </a>
                            )}
                            {!c.anexo_boletim_url && !c.anexo_nota_fiscal_url && !c.comprovante_url && (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {podeDarBaixa && c.status !== 'recebido' && c.status !== 'cancelado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Dar Baixa"
                                onClick={() => setBaixaConta(c)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <ArrowDownCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {podeDarBaixa && c.status !== 'recebido' && c.status !== 'cancelado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Cancelar"
                                onClick={() => handleCancelar(c)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {baixaConta && (
        <BaixaContaReceberModal
          open={!!baixaConta}
          onClose={() => setBaixaConta(null)}
          conta={baixaConta}
          onBaixada={() => { refetch(); queryClient.invalidateQueries(['contas-receber-obra', obraId]); }}
        />
      )}
    </div>
  );
}