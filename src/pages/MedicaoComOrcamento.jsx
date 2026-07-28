import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function MedicaoComOrcamento() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [novaMedicao, setNovaMedicao] = useState({
    obra_id: '',
    periodo_inicio: '',
    periodo_fim: '',
    itens: []
  });
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.Orcamento.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list('-created_date', 100)
  });

  const { data: itensMedicao = [] } = useQuery({
    queryKey: ['itens-medicao-orcamento'],
    queryFn: () => base44.entities.ItemMedicaoOrcamento.list()
  });

  const medicoesFiltradas = obraFiltro === 'todas'
    ? medicoes
    : medicoes.filter(m => m.obra_id === obraFiltro);

  const calcularImpostos = (valorBase) => {
    const iss = valorBase * 0.05; // 5%
    const inss = valorBase * 0.11; // 11%
    const irpj = valorBase * 0.048; // 4.8%
    return {
      iss,
      inss,
      irpj,
      total: iss + inss + irpj
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medição com Orçamento"
        subtitle="Medições vinculadas ao orçamento e composições SINAPI"
        action={() => setDialogAberto(true)}
        actionLabel="Nova Medição"
        actionIcon={Plus}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-white mb-1">{medicoes.length}</div>
            <div className="text-sm text-slate-400">Medições Totais</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-800/30 to-blue-900/20 border border-blue-700/30">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-400 mb-1">
              {medicoes.filter(m => m.status === 'aprovada').length}
            </div>
            <div className="text-sm text-slate-400">Aprovadas</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-800/30 to-amber-900/20 border border-amber-700/30">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-400 mb-1">
              {medicoes.filter(m => m.status === 'pendente').length}
            </div>
            <div className="text-sm text-slate-400">Pendentes</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-800/30 to-emerald-900/20 border border-emerald-700/30">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-400 mb-1">
              R$ {medicoes.reduce((sum, m) => sum + (m.valor_total || 0), 0).toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-slate-400">Valor Total</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={obraFiltro} onValueChange={setObraFiltro}>
            <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="todas">Todas as Obras</SelectItem>
              {obras.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {medicoesFiltradas.map(medicao => {
          const obra = obras.find(o => o.id === medicao.obra_id);
          const itens = itensMedicao.filter(i => i.medicao_id === medicao.id);
          const impostos = calcularImpostos(medicao.valor_total || 0);
          const valorLiquido = (medicao.valor_total || 0) - impostos.total;

          return (
            <Card key={medicao.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">Medição #{medicao.numero || medicao.id.slice(0, 8)}</h3>
                      <Badge className={
                        medicao.status === 'aprovada' ? 'bg-emerald-600' :
                        medicao.status === 'pendente' ? 'bg-amber-600' :
                        'bg-slate-600'
                      }>
                        {medicao.status}
                      </Badge>
                    </div>
                    <p className="text-slate-400">{obra?.nome || 'Obra não identificada'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-slate-500 text-sm">Período</p>
                    <p className="text-white">
                      {new Date(medicao.periodo_inicio).toLocaleDateString('pt-BR')} - 
                      {new Date(medicao.periodo_fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">Valor Bruto</p>
                    <p className="text-white font-bold">R$ {medicao.valor_total?.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">Impostos</p>
                    <p className="text-red-400 font-bold">- R$ {impostos.total.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">Valor Líquido</p>
                    <p className="text-emerald-400 font-bold">R$ {valorLiquido.toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                {itens.length > 0 && (
                  <div className="border-t border-slate-700 pt-4">
                    <p className="text-slate-400 text-sm mb-2">Itens Vinculados ao Orçamento ({itens.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {itens.slice(0, 5).map(item => (
                        <div key={item.id} className="bg-slate-800/40 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{item.descricao}</p>
                              <p className="text-slate-500 text-xs">
                                {item.codigo_item} | {item.quantidade_medida_atual} {item.unidade}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-400 font-bold text-sm">
                                R$ {item.valor_medido?.toLocaleString('pt-BR')}
                              </p>
                              <p className="text-slate-500 text-xs">
                                {item.percentual_executado?.toFixed(1)}% executado
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-700 pt-4 mt-4">
                  <p className="text-slate-400 text-sm mb-2">Detalhamento de Impostos:</p>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">ISS (5%)</p>
                      <p className="text-white">R$ {impostos.iss.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">INSS (11%)</p>
                      <p className="text-white">R$ {impostos.inss.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">IRPJ (4,8%)</p>
                      <p className="text-white">R$ {impostos.irpj.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total Impostos</p>
                      <p className="text-red-400 font-bold">R$ {impostos.total.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}