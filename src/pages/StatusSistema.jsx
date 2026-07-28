import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function StatusSistema() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const carregarStatus = async () => {
    try {
      setCarregando(true);
      const { data } = await base44.functions.invoke('getStatusSistema', {});
      setDados(data);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  if (carregando || !dados) {
    return <PageSkeleton kpis={4} rows={6} cols={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Status do Sistema</h1>
          <p className="text-gray-600 mt-1">Healthcheck e diagnóstico</p>
        </div>
        <Button onClick={carregarStatus} disabled={carregando} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                dados.sistema === 'online' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {dados.sistema === 'online' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Sistema</p>
                <p className="font-semibold capitalize">{dados.sistema}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                dados.database === 'online' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {dados.database === 'online' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Database</p>
                <p className="font-semibold capitalize">{dados.database}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Obras</p>
            <p className="text-3xl font-bold text-gray-900">{dados.stats.total_obras}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Usuários</p>
            <p className="text-3xl font-bold text-gray-900">{dados.stats.total_usuarios}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Ordens de Compra</p>
            <p className="text-3xl font-bold text-gray-900">{dados.stats.total_ocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Medições</p>
            <p className="text-3xl font-bold text-gray-900">{dados.stats.total_medicoes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Últimas Execuções */}
      {dados.ultimas_execucoes && dados.ultimas_execucoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dados.ultimas_execucoes.slice(0, 10).map((exec, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(exec.data).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Entidade</p>
                      <p className="font-semibold">{exec.entidade}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Operação</p>
                      <p className="font-semibold capitalize">{exec.operacao}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Função</p>
                      <p className="font-semibold text-xs truncate">{exec.funcao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Erros Recentes */}
      {dados.ultimos_erros && dados.ultimos_erros.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-900">Erros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dados.ultimos_erros.slice(0, 10).map((erro, idx) => (
                <div key={idx} className="p-3 bg-white rounded border border-red-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(erro.data).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tipo de Impacto</p>
                      <p className="font-semibold capitalize">{erro.tipo_impacto}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Erro</p>
                      <p className="font-semibold text-xs text-red-600 truncate">{erro.erro}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!dados.ultimos_erros || dados.ultimos_erros.length === 0) && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-semibold">Nenhum erro registrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}