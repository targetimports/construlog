import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PackageCheck } from 'lucide-react';

export default function RegistrarRecebimento({ requisicao, onRegistrar }) {
  const [dialog, setDialog] = useState(false);
  const [quantidadesReceber, setQuantidadesReceber] = useState({});

  const itensAReceber = requisicao.itens?.filter(item => 
    item.status === 'a_receber' || item.status === 'recebido_parcial'
  ) || [];

  const handleOpen = () => {
    const inicial = {};
    itensAReceber.forEach((item, index) => {
      const qtdRestante = (item.quantidade_aprovada || 0) - (item.quantidade_recebida || 0);
      inicial[index] = qtdRestante;
    });
    setQuantidadesReceber(inicial);
    setDialog(true);
  };

  const confirmarRecebimento = async () => {
    const recebimentos = itensAReceber.map((item, idx) => ({
      item_index: requisicao.itens.indexOf(item),
      quantidade_receber: quantidadesReceber[idx] || 0
    })).filter(r => r.quantidade_receber > 0);

    await onRegistrar(recebimentos);
    setDialog(false);
  };

  if (itensAReceber.length === 0) return null;

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
      >
        <PackageCheck className="w-4 h-4" />
        Registrar Recebimento
      </Button>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Registrar Recebimento de Itens</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Informe a quantidade recebida de cada item:
            </p>
            
            <div className="overflow-x-auto border border-gray-800 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">Item</TableHead>
                    <TableHead className="text-gray-400">Un</TableHead>
                    <TableHead className="text-gray-400 text-right">Qtd Aprovada</TableHead>
                    <TableHead className="text-gray-400 text-right">Já Recebido</TableHead>
                    <TableHead className="text-gray-400 text-right">Restante</TableHead>
                    <TableHead className="text-gray-400 text-right">Receber Agora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensAReceber.map((item, index) => {
                    const qtdRestante = (item.quantidade_aprovada || 0) - (item.quantidade_recebida || 0);
                    return (
                      <TableRow key={index} className="border-gray-800">
                        <TableCell className="text-white">{item.descricao}</TableCell>
                        <TableCell className="text-gray-400">{item.unidade}</TableCell>
                        <TableCell className="text-white text-right">{item.quantidade_aprovada}</TableCell>
                        <TableCell className="text-blue-400 text-right">{item.quantidade_recebida || 0}</TableCell>
                        <TableCell className="text-amber-400 text-right font-semibold">{qtdRestante}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            max={qtdRestante}
                            value={quantidadesReceber[index] || 0}
                            onChange={(e) => {
                              const valor = parseFloat(e.target.value) || 0;
                              setQuantidadesReceber({
                                ...quantidadesReceber,
                                [index]: Math.min(valor, qtdRestante)
                              });
                            }}
                            className="w-28 bg-gray-800 border-gray-700 text-white text-right"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button
                variant="outline"
                onClick={() => setDialog(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarRecebimento}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Confirmar Recebimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}