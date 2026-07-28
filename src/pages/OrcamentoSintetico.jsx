import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart3, Download } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

export default function OrcamentoSintetico() {
  const [obra, setObra] = useState('');
  const [filtro, setFiltro] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos-sintetico'],
    queryFn: () => base44.entities.Orcamento.filter({ status: 'aprovado' })
  });

  const resumoOrcamentos = orcamentos.reduce((acc, orcamento) => {
    return {
      total: acc.total + (orcamento.valor_total || 0),
      quantidade: acc.quantidade + 1,
      margem: acc.margem + (orcamento.margem_lucro_percentual || 0)
    };
  }, { total: 0, quantidade: 0, margem: 0 });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orçamento Sintético</h1>
        <p className="text-gray-600 mt-1">Resumo consolidado de orçamentos por obra</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Valor Total</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              R$ {resumoOrcamentos.total.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Orçamentos aprovados</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Quantidade</div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              {resumoOrcamentos.quantidade}
            </div>
            <div className="text-xs text-gray-500 mt-1">Orçamentos</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Margem Média</div>
            <div className="text-2xl font-bold text-orange-600 mt-2">
              {(resumoOrcamentos.margem / (resumoOrcamentos.quantidade || 1)).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Lucro</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Sintética */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Orçamentos por Obra
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : orcamentos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum orçamento aprovado. Crie orçamentos em Orçamento Analítico.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Margem (%)</TableHead>
                    <TableHead className="text-right">Proposta</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentos.map(orcamento => (
                    <TableRow key={orcamento.id} className="hover:bg-gray-50">
                      <TableCell className="font-semibold">{orcamento.titulo}</TableCell>
                      <TableCell>{orcamento.versao}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {orcamento.valor_total?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {orcamento.margem_lucro_percentual?.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {orcamento.valor_proposta?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge>Aprovado</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}