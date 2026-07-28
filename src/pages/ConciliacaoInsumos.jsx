import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Link as LinkIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function ConciliacaoInsumos() {
  const [tab, setTab] = useState('analise');
  const [material_selecionado, setMaterialSelecionado] = useState(null);
  const [insumo_escolhido, setInsumoEscolhido] = useState(null);
  const queryClient = useQueryClient();

  const { data: analise, isLoading: analiseLoading } = useQuery({
    queryKey: ['analise-divergencias'],
    queryFn: () => base44.functions.invoke('analisarDivergenciasInsumos', {})
  });

  const { mutate: confirmarVinculo, isPending: pendingVinculo } = useMutation({
    mutationFn: (data) => base44.functions.invoke('confirmarVinculoInsumo', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analise-divergencias'] });
      toast.success('Vínculo confirmado!');
      setMaterialSelecionado(null);
      setInsumoEscolhido(null);
    }
  });

  const { mutate: rejeitarVinculo } = useMutation({
    mutationFn: (data) => base44.functions.invoke('rejeitarVinculoInsumo', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analise-divergencias'] });
      toast.info('Vínculo rejeitado. Buscando próxima sugestão...');
    }
  });

  if (analiseLoading) {
    return <div className="p-6 text-center">Analisando divergências...</div>;
  }

  const resumo = analise?.data?.resumo || {};
  const materiais = analise?.data?.materiais_sem_insumo || [];
  const insumos_desv = analise?.data?.insumos_sem_vinculo_estoque || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-8 h-8 text-amber-600" />
            Conciliação de Insumos
          </h1>
          <p className="text-gray-600 mt-1">Vincule orçamento, estoque e compras à mesma base de insumos</p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 uppercase">Insumos Cadastrados</p>
              <p className="text-2xl font-bold text-gray-900">{resumo.total_insumos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 uppercase">Desvinculados</p>
              <p className={`text-2xl font-bold ${(resumo.insumos_desvinculados || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {resumo.insumos_desvinculados || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 uppercase">Vínculos Confirmados</p>
              <p className="text-2xl font-bold text-green-600">{resumo.vinculos_confirmados || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 uppercase">Pendentes</p>
              <p className="text-2xl font-bold text-amber-600">{(resumo.materiais_desvinculados || 0) + (resumo.insumos_desvinculados || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setTab('analise')}
            className={`px-4 py-3 font-semibold ${tab === 'analise' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Análise
          </button>
          <button
            onClick={() => setTab('vincular')}
            className={`px-4 py-3 font-semibold ${tab === 'vincular' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Vincular Materiais ({materiais.length})
          </button>
          <button
            onClick={() => setTab('desvinculados')}
            className={`px-4 py-3 font-semibold ${tab === 'desvinculados' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Insumos s/ Estoque ({insumos_desv.length})
          </button>
        </div>

        {/* Conteúdo */}
        {tab === 'analise' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Status da Conciliação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span>{resumo.vinculos_confirmados || 0} vínculos confirmados</span>
                </div>
                {(resumo.vinculos_propostos || 0) > 0 && (
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>{resumo.vinculos_propostos || 0} vínculos aguardando confirmação</span>
                  </div>
                )}
                {(resumo.materiais_desvinculados || 0) > 0 && (
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span>{resumo.materiais_desvinculados || 0} materiais antigos sem vínculo</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Próximas Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-semibold text-blue-900">1Vincular Materiais Antigos</p>
                  <p className="text-blue-800 text-xs mt-1">Revise os materiais de estoque antigos e vincule-os a insumos. O sistema sugerirá correspondências automáticas.</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                  <p className="font-semibold text-green-900">2Revisar Insumos Desvinculados</p>
                  <p className="text-green-800 text-xs mt-1">Alguns insumos podem ter sido criados mas não possuem saldo de estoque. Verifique se precisam de integração com estoque existente.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'vincular' && (
          <div>
            {materiais.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-green-600">
                  ✓ Todos os materiais antigos já foram vinculados!
                </CardContent>
              </Card>
            ) : material_selecionado ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" />
                    Vincular: {material_selecionado.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
                    Selecione o insumo correspondente ou rejeite as sugestões para pesquisar manualmente.
                  </div>

                  <div className="space-y-2">
                    {material_selecionado.sugestoes_vinculacao?.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInsumoEscolhido(sug)}
                        className={`w-full text-left border-2 rounded-lg p-4 transition ${
                          insumo_escolhido?.insumo_id === sug.insumo_id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{sug.insumo_descricao}</p>
                            <p className="text-xs text-gray-600">{sug.insumo_codigo}</p>
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {sug.motivos_match?.map(motivo => (
                                <Badge key={motivo} className="bg-green-100 text-green-800 text-xs">
                                  {motivo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{sug.confianca}%</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setMaterialSelecionado(null)}
                    >
                      Voltar
                    </Button>
                    {insumo_escolhido && (
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          confirmarVinculo({
                            insumo_id: insumo_escolhido.insumo_id,
                            material_estoque_id: material_selecionado.material_id,
                            tipo_vinculo: 'manual'
                          });
                        }}
                        disabled={pendingVinculo}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Vínculo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {materiais.map(mat => (
                  <Card key={mat.material_id} className="cursor-pointer hover:shadow-lg transition">
                    <CardContent
                      className="p-4 flex justify-between items-center"
                      onClick={() => setMaterialSelecionado(mat)}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{mat.nome}</p>
                        <p className="text-xs text-gray-600">{mat.codigo}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-amber-100 text-amber-800">
                          {mat.sugestoes_vinculacao?.length || 0} sugestões
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'desvinculados' && (
          <Card>
            <CardContent className="p-6">
              {insumos_desv.length === 0 ? (
                <div className="text-center text-green-600">
                  ✓ Todos os insumos estão vinculados a estoque!
                </div>
              ) : (
                <div className="space-y-3">
                  {insumos_desv.map(ins => (
                    <div key={ins.insumo_id} className="border rounded-lg p-3">
                      <p className="font-semibold text-gray-900">{ins.descricao}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                        <p>Código: {ins.codigo}</p>
                        <p>Grupo: {ins.grupo}</p>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        Este insumo existe no orçamento/composições mas não tem saldo de estoque.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}