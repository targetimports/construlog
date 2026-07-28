import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

export default function IASuggestionsTable({ sugestoes, loading = false, onApply, onReject }) {
  const [selecionadas, setSelecionadas] = useState({});

  const handleToggle = (codigo) => {
    setSelecionadas(prev => ({
      ...prev,
      [codigo]: !prev[codigo]
    }));
  };

  const handleAplicar = async () => {
    const selecionadasArray = sugestoes.filter(s => selecionadas[s.contrato_item_id]);
    if (selecionadasArray.length === 0) {
      toast.error('Selecione sugestões para aplicar');
      return;
    }
    await onApply(selecionadasArray);
  };

  const handleRejeitar = async () => {
    const selecionadasArray = sugestoes.filter(s => selecionadas[s.contrato_item_id]);
    if (selecionadasArray.length === 0) {
      toast.error('Selecione sugestões para rejeitar');
      return;
    }
    await onReject(selecionadasArray);
  };

  if (loading) {
    return <div className="h-64 bg-gray-100 rounded animate-pulse" />;
  }

  if (!sugestoes || sugestoes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Sem sugestões disponíveis
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={sugestoes.every(s => selecionadas[s.contrato_item_id])}
                  onChange={(e) => {
                    const newState = {};
                    sugestoes.forEach(s => {
                      newState[s.contrato_item_id] = e.target.checked;
                    });
                    setSelecionadas(newState);
                  }}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Atual</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="text-right">Confiança</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sugestoes.map((s) => (
              <TableRow key={s.contrato_item_id} className={selecionadas[s.contrato_item_id] ? 'bg-blue-50' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selecionadas[s.contrato_item_id] || false}
                    onChange={() => handleToggle(s.contrato_item_id)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell className="text-sm font-mono">{s.contrato_item_id}</TableCell>
                <TableCell className="text-right text-sm">{s.quantidade_atual.toFixed(4)}</TableCell>
                <TableCell className="text-right text-sm font-semibold text-blue-600">
                  {s.quantidade_sugerida.toFixed(4)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge 
                    variant={s.confianca > 80 ? 'default' : s.confianca > 60 ? 'secondary' : 'outline'}
                  >
                    {s.confianca}%
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                  {s.motivo}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2 justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRejeitar}
        >
          <ThumbsDown className="w-4 h-4 mr-1" /> Rejeitar
        </Button>
        <Button 
          size="sm"
          onClick={handleAplicar}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <ThumbsUp className="w-4 h-4 mr-1" /> Aplicar
        </Button>
      </div>
    </div>
  );
}