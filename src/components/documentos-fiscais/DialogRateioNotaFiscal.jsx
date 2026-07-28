import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Download } from 'lucide-react';

export default function DialogRateioNotaFiscal({ nf, open, onClose, onSuccess }) {
  const qc = useQueryClient();
  const [rateio, setRateio] = useState([]);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Buscar rateio existente
  const { data: rateioExistente = [] } = useQuery({
    queryKey: ['nf-rateio', nf?.id],
    queryFn: () => nf?.id ? base44.entities.DocumentoFiscalRateio.filter({ documento_fiscal_id: nf.id }, null, 100) : [],
    enabled: !!nf?.id && open,
  });

  useEffect(() => {
    if (rateioExistente.length > 0) {
      setRateio(rateioExistente);
    }
  }, [rateioExistente]);

  const valorTotal = nf?.valor_final_ajustado || nf?.valor_total || 0;
  const totalRateado = rateio.reduce((sum, r) => sum + (Number(r.valor_rateado) || 0), 0);
  const diferenca = Math.abs(totalRateado - valorTotal);
  const estaBalanceado = diferenca < 0.01;

  const calcularAutomatico = async () => {
    setCalculando(true);
    try {
      const { data } = await base44.functions.invoke('calcularRateioNotaFiscal', {
        nf_id: nf.id
      });
      
      setRateio(data.rateio);
      toast.success('Rateio calculado automaticamente');
    } catch (error) {
      toast.error('Erro ao calcular: ' + error.message);
    } finally {
      setCalculando(false);
    }
  };

  const salvarManual = async () => {
    if (!estaBalanceado) {
      toast.error(`Soma do rateio (R$ ${totalRateado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) não corresponde ao valor total (R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      return;
    }

    setSalvando(true);
    try {
      // Limpar rateios anteriores
      const rateiosAntigos = await base44.entities.DocumentoFiscalRateio.filter(
        { documento_fiscal_id: nf.id },
        null,
        500
      );

      for (const r of rateiosAntigos) {
        await base44.entities.DocumentoFiscalRateio.delete(r.id);
      }

      // Salvar novos
      for (const r of rateio) {
        if (Number(r.valor_rateado) > 0) {
          await base44.entities.DocumentoFiscalRateio.create({
            documento_fiscal_id: nf.id,
            obra_id: r.obra_id,
            obra_nome: r.obra_nome,
            valor_rateado: Number(r.valor_rateado),
            percentual: (Number(r.valor_rateado) / valorTotal * 100)
          });
        }
      }

      qc.invalidateQueries({ queryKey: ['nf-rateio', nf.id] });
      toast.success('Rateio salvo com sucesso');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleEditarValor = (idx, novoValor) => {
    const newRateio = [...rateio];
    newRateio[idx].valor_rateado = novoValor;
    setRateio(newRateio);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rateio de Valor - NF {nf?.numero}</DialogTitle>
          <DialogDescription>
            Valor Total: R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aviso */}
          {rateio.length === 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Clique em "Calcular Automaticamente" para distribuir o valor entre as obras baseado no Pedido Consolidado.</p>
            </div>
          )}

          {/* Status Balanceamento */}
          {rateio.length > 0 && (
            <div className={`p-3 rounded-lg flex justify-between items-center ${
              estaBalanceado ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <span className={`text-sm font-semibold ${estaBalanceado ? 'text-green-900' : 'text-red-900'}`}>
                {estaBalanceado ? '✓ Rateio balanceado' : '✗ Soma não bate'}
              </span>
              <span className={`text-lg font-bold ${estaBalanceado ? 'text-green-600' : 'text-red-600'}`}>
                R$ {totalRateado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Tabela de Rateio */}
          {rateio.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900">Obra</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Valor Rateado</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rateio.map((r, idx) => (
                    <tr key={r.obra_id || idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{r.obra_nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={r.valor_rateado || 0}
                            onChange={(e) => handleEditarValor(idx, Number(e.target.value))}
                            className="h-8 w-24 text-right text-sm"
                            disabled={salvando}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {valorTotal > 0 ? ((Number(r.valor_rateado) / valorTotal * 100).toFixed(1)) : '0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={calculando || salvando}
              className="flex-1"
            >
              Cancelar
            </Button>
            {rateio.length === 0 ? (
              <Button
                onClick={calcularAutomatico}
                disabled={calculando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {calculando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Calculando...</>
                ) : (
                  <><Download className="w-4 h-4" />Calcular Automaticamente</>
                )}
              </Button>
            ) : (
              <Button
                onClick={salvarManual}
                disabled={!estaBalanceado || salvando}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {salvando ? 'Salvando...' : 'Salvar Rateio'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}