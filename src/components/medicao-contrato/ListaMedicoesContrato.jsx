import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, CheckCircle, Paperclip, ChevronLeft, DollarSign, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import MedicaoContratoModal from './MedicaoContratoModal';
import GerarContaReceberModal from '../conta-receber/GerarContaReceberModal';

const statusConfig = {
  rascunho: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-600' },
  enviada: { label: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-green-100 text-green-700' }
};

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function recalcularMedidoContrato(contratoId, queryClient) {
  const medicoes = await base44.entities.MedicaoContrato.filter({ contrato_id: contratoId });
  const totalMedido = medicoes
    .filter(m => m.status === 'aprovada')
    .reduce((acc, m) => acc + (m.valor_bruto || 0), 0);
  await base44.entities.ContratoObra.update(contratoId, { valor_total_medido: totalMedido });
  queryClient.invalidateQueries(['contratos-obra']);
  queryClient.invalidateQueries(['contrato-detail', contratoId]);
}

export default function ListaMedicoesContrato({ obraId, contrato, onBack }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [gerarContaMedicao, setGerarContaMedicao] = useState(null);

  const { data: medicoes = [], isLoading, refetch } = useQuery({
    queryKey: ['medicoes-contrato', contrato?.id],
    queryFn: () => base44.entities.MedicaoContrato.filter({ contrato_id: contrato.id }, 'numero_medicao'),
    enabled: !!contrato?.id
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-contrato', contrato?.id],
    queryFn: () => base44.entities.ContaReceberObra.filter({ contrato_id: contrato.id }),
    enabled: !!contrato?.id
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const podeAprovar = user?.role === 'admin' || ['engenharia', 'supervisor', 'programador'].includes(user?.perfil_acesso);

  async function handleAprovar(m) {
    await base44.entities.MedicaoContrato.update(m.id, {
      status: 'aprovada',
      aprovado_por: user?.email,
      data_aprovacao: new Date().toISOString()
    });
    toast.success('Medição aprovada.');
    await recalcularMedidoContrato(contrato.id, queryClient);
    refetch();
  }

  async function handleSaved() {
    await refetch();
    await recalcularMedidoContrato(contrato.id, queryClient);
  }

  function openNew() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(m) {
    setEditing(m);
    setShowModal(true);
  }

  const totalBruto = medicoes.filter(m => m.status === 'aprovada').reduce((a, m) => a + (m.valor_bruto || 0), 0);
  const saldo = (contrato?.valor_total_contrato || 0) - totalBruto;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Medições do Contrato</h2>
            <p className="text-xs text-gray-500">{contrato?.numero_contrato} — {contrato?.cliente}</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" />
          Nova Medição
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Valor do Contrato</p>
          <p className="font-bold text-gray-900 text-sm">{fmt(contrato?.valor_total_contrato)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Medido (Aprovado)</p>
          <p className="font-bold text-blue-700 text-sm">{fmt(totalBruto)}</p>
        </div>
        <div className={`border rounded-lg p-3 text-center ${saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Saldo</p>
          <p className={`font-bold text-sm ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldo)}</p>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-gray-500 text-sm py-4">Carregando...</p>
      ) : medicoes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500 text-sm">Nenhuma medição cadastrada.</p>
            <Button onClick={openNew} variant="outline" className="mt-3 gap-2">
              <Plus className="w-4 h-4" /> Criar primeira medição
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nº</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Calculado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Oficial</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Retenção</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Líquido</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Anexos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicoes.map(m => {
                    const st = statusConfig[m.status] || statusConfig.rascunho;
                    const temAnexos = m.anexo_boletim_url || m.anexo_nota_fiscal_url;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">#{m.numero_medicao || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.data_medicao ? new Date(m.data_medicao).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(m.valor_bruto)}</td>
                         <td className="px-4 py-3 text-right">
                           {m.valor_real_oficial != null ? (() => {
                             const diff = m.valor_real_oficial - (m.valor_bruto || 0);
                             const pct = m.valor_bruto > 0 ? Math.abs(diff / m.valor_bruto * 100) : 0;
                             const diverge = pct > 5;
                             return (
                               <div className="flex flex-col items-end gap-0.5">
                                 <span className={`font-semibold ${diverge ? 'text-amber-700' : 'text-green-700'}`}>{fmt(m.valor_real_oficial)}</span>
                                 {m.valor_real_fonte && <span className="text-xs text-gray-400">{m.valor_real_fonte}</span>}
                                 {diverge && (
                                   <span title={`Divergência de ${pct.toFixed(1)}%`} className="flex items-center gap-0.5 text-xs text-amber-600">
                                     <AlertTriangle className="w-3 h-3" />{pct.toFixed(1)}%
                                   </span>
                                 )}
                                 {!diverge && <ShieldCheck className="w-3 h-3 text-green-500" />}
                               </div>
                             );
                           })() : <span className="text-gray-300 text-xs">—</span>}
                         </td>
                         <td className="px-4 py-3 text-right text-red-600 text-xs">
                           {fmt(m.valor_retencao)}
                           <span className="text-gray-400 ml-1">({m.percentual_retencao_aplicado || 0}%)</span>
                         </td>
                         <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt(m.valor_liquido_calculado)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${st.cls}`}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {temAnexos ? (
                            <div className="flex items-center justify-center gap-1">
                              {m.anexo_boletim_url && (
                                <a href={m.anexo_boletim_url} target="_blank" rel="noreferrer" title="Boletim" className="text-blue-500 hover:text-blue-700">
                                  <Paperclip className="w-4 h-4" />
                                </a>
                              )}
                              {m.anexo_nota_fiscal_url && (
                                <a href={m.anexo_nota_fiscal_url} target="_blank" rel="noreferrer" title="Nota Fiscal" className="text-green-500 hover:text-green-700">
                                  <Paperclip className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end flex-wrap">
                            {m.status !== 'aprovada' && (
                              <Button size="sm" variant="ghost" onClick={() => openEdit(m)} title="Editar">
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {m.status !== 'aprovada' && podeAprovar && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAprovar(m)}
                                title="Aprovar"
                                className="text-green-600 hover:text-green-800"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {m.status === 'aprovada' && (() => {
                              const jaTemConta = contasReceber.some(c => c.origem_id === m.id && c.status !== 'cancelado');
                              return jaTemConta ? (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" /> Conta gerada
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setGerarContaMedicao(m)}
                                  className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <DollarSign className="w-3 h-3" /> Gerar Conta
                                </Button>
                              );
                            })()}
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

      <MedicaoContratoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        obraId={obraId}
        contrato={contrato}
        editing={editing}
        onSaved={handleSaved}
      />

      {gerarContaMedicao && (
        <GerarContaReceberModal
          open={!!gerarContaMedicao}
          onClose={() => setGerarContaMedicao(null)}
          medicao={gerarContaMedicao}
          contrato={contrato}
          onGerada={() => {
            setGerarContaMedicao(null);
            queryClient.invalidateQueries(['contas-receber-contrato', contrato?.id]);
            queryClient.invalidateQueries(['contas-receber-obra']);
          }}
        />
      )}
    </div>
  );
}