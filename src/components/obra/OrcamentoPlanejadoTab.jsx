import React, { useState, useEffect } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function OrcamentoPlanejadoTab({ obraId }) {
  const [orcamento, setOrcamento] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [estrutura, setEstrutura] = useState(null);

  const { isLoading: loadingOrcamento } = useQuery({
    queryKey: ['orcamento-planejado', obraId],
    queryFn: async () => {
      console.log(`[OrcamentoPlanejado] Buscando com obraId: ${obraId}`);
      const result = await base44.entities.OrcamentoPlanejado.filter({
        obra_id: obraId
      });
      console.log(`[OrcamentoPlanejado] Resultado: ${result.length} registros encontrados`, result);
      if (result.length > 0) {
        const orc = result[0];
        setOrcamento(orc);
        
        // Carregar etapas
        const etapasResult = await base44.entities.OrcamentoPlanejadoEtapa.filter({
          orcamento_planejado_id: orc.id
        });
        console.log(`[OrcamentoPlanejado] Etapas encontradas: ${etapasResult?.length || 0}`);
        setEtapas(etapasResult || []);
        
        // Parse estrutura JSON
        if (orc.estrutura_json) {
          try {
            setEstrutura(JSON.parse(orc.estrutura_json));
          } catch (e) {
            console.error('[OrcamentoPlanejado] Erro ao parsear estrutura JSON:', e);
          }
        }
      }
      return result;
    },
    enabled: !!obraId,
    staleTime: 300000
  });

  if (loadingOrcamento) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  if (!orcamento) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-900">
          Esta obra ainda não tem Orçamento Planejado. Importe pelo OrçaFascio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Totais */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(orcamento.total_geral || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sem BDI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(orcamento.total_sem_bdi || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">BDI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(orcamento.total_bdi || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">% BDI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(orcamento.bdi_percentual || 0).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Etapas */}
      {etapas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Etapas do Orçamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-semibold">Etapa</th>
                    <th className="text-right py-2 px-4 font-semibold">Valor</th>
                    <th className="text-right py-2 px-4 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {etapas.map((etapa) => (
                    <tr key={etapa.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{etapa.nome_etapa}</td>
                      <td className="text-right py-3 px-4">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(etapa.valor_etapa || 0)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {(etapa.percentual_etapa || 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linhas do Orçamento (se houver estrutura) */}
      {estrutura?.linhas && estrutura.linhas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Linhas do Orçamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-semibold">Item</th>
                    <th className="text-left py-2 px-2 font-semibold">Descrição</th>
                    <th className="text-center py-2 px-2 font-semibold">Und</th>
                    <th className="text-right py-2 px-2 font-semibold">Quant</th>
                    <th className="text-right py-2 px-2 font-semibold">Valor Unit</th>
                    <th className="text-right py-2 px-2 font-semibold">Total</th>
                    <th className="text-left py-2 px-2 font-semibold">Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {estrutura.linhas.map((linha, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{linha.item}</td>
                      <td className="py-2 px-2">{linha.descricao}</td>
                      <td className="text-center py-2 px-2">{linha.und}</td>
                      <td className="text-right py-2 px-2">{(linha.quant || 0).toLocaleString('pt-BR')}</td>
                      <td className="text-right py-2 px-2">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(linha.valor_unit || 0)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(linha.total || 0)}
                      </td>
                      <td className="py-2 px-2 text-xs">{linha.etapa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}