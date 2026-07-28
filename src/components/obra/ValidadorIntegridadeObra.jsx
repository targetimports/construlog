import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertTriangle, Shield, RefreshCw } from 'lucide-react';

export default function ValidadorIntegridadeObra({ obra_id }) {
  const [resultado, setResultado] = useState(null);
  const [dialogAberto, setDialogAberto] = useState(false);

  const validar = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('validarIntegridadeObra', { obra_id });
      setResultado(res.data);
      setDialogAberto(true);
      return res.data;
    }
  });

  const StatusIcon = ({ ok }) => {
    if (ok) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <>
      <Button
        onClick={() => validar.mutate()}
        disabled={validar.isPending}
        variant="outline"
        className="gap-2"
      >
        {validar.isPending ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Shield className="w-4 h-4" />
        )}
        Validar Integridade Técnica
      </Button>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Relatório de Integridade
            </DialogTitle>
          </DialogHeader>

          {resultado && (
            <div className="space-y-6">
              {/* Status geral */}
              <Card className={resultado.integridade_geral ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    {resultado.integridade_geral ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    )}
                    <div>
                      <p className="text-lg font-bold">
                        {resultado.integridade_geral ? 'Sistema Íntegro' : 'Inconsistências Detectadas'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Validado em {new Date(resultado.data_validacao).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status por módulo */}
              <Card>
                <CardHeader>
                  <CardTitle>Status por Módulo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <StatusIcon ok={resultado.modulos.orcamento_ok} />
                      <span className="font-semibold text-sm">Orçamento</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <StatusIcon ok={resultado.modulos.cpu_ok} />
                      <span className="font-semibold text-sm">CPU</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <StatusIcon ok={resultado.modulos.cronograma_ok} />
                      <span className="font-semibold text-sm">Cronograma</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <StatusIcon ok={resultado.modulos.demanda_ok} />
                      <span className="font-semibold text-sm">Demanda</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <StatusIcon ok={resultado.modulos.medicao_ok} />
                      <span className="font-semibold text-sm">Medição</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contagens */}
              <Card>
                <CardHeader>
                  <CardTitle>Contagens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{resultado.contagens.grupos}</p>
                      <p className="text-xs text-gray-600">Grupos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{resultado.contagens.itens}</p>
                      <p className="text-xs text-gray-600">Itens</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{resultado.contagens.composicoes}</p>
                      <p className="text-xs text-gray-600">Composições</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{resultado.contagens.linhas_cpu}</p>
                      <p className="text-xs text-gray-600">Linhas CPU</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{resultado.contagens.periodos_cronograma}</p>
                      <p className="text-xs text-gray-600">Períodos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estatísticas */}
              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas de Validação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Itens sem composição:</span>
                      <span className={`font-bold ${resultado.estatisticas.itens_sem_composicao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {resultado.estatisticas.itens_sem_composicao}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Composições sem linhas:</span>
                      <span className={`font-bold ${resultado.estatisticas.composicoes_sem_linhas > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {resultado.estatisticas.composicoes_sem_linhas}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Insumos inválidos:</span>
                      <span className={`font-bold ${resultado.estatisticas.insumos_invalidos > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {resultado.estatisticas.insumos_invalidos}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Total duplicidades:</span>
                      <span className={`font-bold ${resultado.estatisticas.total_duplicidades > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {resultado.estatisticas.total_duplicidades}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Total inconsistências:</span>
                      <span className={`font-bold ${resultado.estatisticas.total_inconsistencias > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {resultado.estatisticas.total_inconsistencias}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Duplicidades */}
              {resultado.duplicidades && resultado.duplicidades.length > 0 && (
                <Card className="border-l-4 border-red-500">
                  <CardHeader>
                    <CardTitle className="text-red-600 flex items-center gap-2">
                      <XCircle className="w-5 h-5" />
                      Duplicidades Detectadas ({resultado.duplicidades.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                      {resultado.duplicidades.map((dup, idx) => (
                        <li key={idx} className="text-red-700 flex gap-2">
                          <span className="text-red-600 font-bold">•</span>
                          {dup}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Inconsistências */}
              {resultado.inconsistencias && resultado.inconsistencias.length > 0 && (
                <Card className="border-l-4 border-yellow-500">
                  <CardHeader>
                    <CardTitle className="text-yellow-600 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Inconsistências Detectadas ({resultado.inconsistencias.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                      {resultado.inconsistencias.map((inc, idx) => (
                        <li key={idx} className="text-yellow-700 flex gap-2">
                          <span className="text-yellow-600 font-bold">•</span>
                          {inc}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setDialogAberto(false)}>
                  Fechar
                </Button>
                <Button onClick={() => validar.mutate()} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Revalidar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}