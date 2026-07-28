import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tipoConfig = {
  entrada: { 
    label: 'Entrada', 
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: ArrowDownRight
  },
  saida: { 
    label: 'Saída', 
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: ArrowUpRight
  },
  transferencia: { 
    label: 'Transferência', 
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: ArrowRightLeft
  },
  ajuste: { 
    label: 'Ajuste', 
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: ArrowRightLeft
  }
};

export default function HistoricoMovimentacoes({ movimentacoes, materiais, obras }) {
  const getMaterial = (id) => materiais.find(m => m.id === id);
  const getObra = (id) => obras.find(o => o.id === id);

  return (
    <div className="space-y-4">
      {movimentacoes.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Nenhuma movimentação registrada</p>
          </CardContent>
        </Card>
      ) : (
        movimentacoes.map(mov => {
          const material = getMaterial(mov.material_id);
          const tipo = tipoConfig[mov.tipo] || tipoConfig.entrada;
          const TipoIcon = tipo.icon;
          const obraOrigem = getObra(mov.obra_origem_id);
          const obraDestino = getObra(mov.obra_destino_id);

          return (
            <Card key={mov.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn("p-3 rounded-xl", tipo.color.split(' ')[0])}>
                      <TipoIcon className={cn("w-5 h-5", tipo.color.split(' ')[1])} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-semibold">{material?.nome || 'Material não encontrado'}</h4>
                        <Badge className={cn("border", tipo.color)}>
                          {tipo.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <span>Qtd: {mov.quantidade} {material?.unidade}</span>
                        {mov.valor_total && (
                          <span>Valor: {mov.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        )}
                      </div>
                      {mov.tipo === 'transferencia' && (
                        <div className="mt-2 text-sm text-gray-400">
                          {obraOrigem?.nome || 'Estoque Central'} → {obraDestino?.nome || 'Estoque Central'}
                        </div>
                      )}
                      {mov.tipo === 'saida' && obraDestino && (
                        <div className="mt-2 text-sm text-gray-400">
                          Destino: {obraDestino.nome}
                        </div>
                      )}
                      {mov.responsavel && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                          <User className="w-3 h-3" />
                          <span>{mov.responsavel}</span>
                        </div>
                      )}
                      {mov.observacoes && (
                        <p className="text-gray-500 text-sm mt-2">{mov.observacoes}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}