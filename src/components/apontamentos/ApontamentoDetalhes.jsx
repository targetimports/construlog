import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, User, MapPin } from 'lucide-react';

export default function ApontamentoDetalhes({ open, onOpenChange, apontamento }) {
  if (!apontamento) return null;

  const statusConfig = {
    rascunho: { color: 'bg-gray-500/10 text-gray-400', label: 'Rascunho' },
    enviado: { color: 'bg-blue-500/10 text-blue-400', label: 'Enviado' },
    validado: { color: 'bg-amber-500/10 text-amber-400', label: 'Validado' },
    concluido: { color: 'bg-emerald-500/10 text-emerald-400', label: 'Concluído' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Detalhes do Apontamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className={statusConfig[apontamento.status]?.color}>
              {statusConfig[apontamento.status]?.label}
            </Badge>
            {apontamento.codigo && (
              <Badge variant="outline" className="border-gray-700 text-gray-400">
                {apontamento.codigo}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {apontamento.data_apontamento && (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs text-gray-500">Data</div>
                      <div className="text-white font-medium">
                        {new Date(apontamento.data_apontamento).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {apontamento.encarregado && (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-xs text-gray-500">Encarregado</div>
                      <div className="text-white font-medium text-sm">{apontamento.encarregado}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {apontamento.materiais && apontamento.materiais.length > 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-4">
                <h4 className="text-white font-medium mb-4">Materiais Apontados ({apontamento.materiais.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 text-gray-400">Material</th>
                        <th className="text-right py-2 text-gray-400">Inventário</th>
                        <th className="text-right py-2 text-gray-400">Teórico</th>
                        <th className="text-right py-2 text-gray-400">Diferença</th>
                        <th className="text-left py-2 text-gray-400">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apontamento.materiais.map((mat, idx) => (
                        <tr key={idx} className="border-b border-gray-700">
                          <td className="py-2 text-white">{mat.material_nome}</td>
                          <td className="text-right text-gray-300">{mat.quantidade_inventario}</td>
                          <td className="text-right text-gray-300">{mat.quantidade_teorica}</td>
                          <td className={`text-right font-medium ${mat.diferenca !== 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {mat.diferenca}
                          </td>
                          <td className="text-gray-400 text-xs">{mat.motivo_diferenca || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {apontamento.observacoes && (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-300">{apontamento.observacoes}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}