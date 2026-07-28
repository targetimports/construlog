import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ShoppingCart, FileText, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AtenderRequisicao({ 
  requisicao, 
  onGerarCotacao, 
  onGerarOrdemCompra, 
  onAtenderSemCompras 
}) {
  const [dialogAtender, setDialogAtender] = useState(false);
  const [tipoAtendimento, setTipoAtendimento] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [dataEntrega, setDataEntrega] = useState('');

  const itensDisponiveis = requisicao.itens?.filter(item => 
    item.status === 'em_aberto' || item.status === 'em_andamento'
  ) || [];

  const handleAtender = (tipo) => {
    setTipoAtendimento(tipo);
    setDialogAtender(true);
    setItensSelecionados([]);
  };

  const confirmarAtendimento = async () => {
    if (itensSelecionados.length === 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }

    const itensParaAtender = requisicao.itens.filter((_, index) => 
      itensSelecionados.includes(index)
    );

    if (tipoAtendimento === 'cotacao') {
      await onGerarCotacao(itensParaAtender);
    } else if (tipoAtendimento === 'ordem') {
      await onGerarOrdemCompra(itensParaAtender);
    } else if (tipoAtendimento === 'sem_compras') {
      await onAtenderSemCompras(itensParaAtender, dataEntrega);
    }

    setDialogAtender(false);
    setItensSelecionados([]);
  };

  const toggleItem = (index) => {
    if (itensSelecionados.includes(index)) {
      setItensSelecionados(itensSelecionados.filter(i => i !== index));
    } else {
      setItensSelecionados([...itensSelecionados, index]);
    }
  };

  if (itensDisponiveis.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => handleAtender('cotacao')}
          className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
        >
          <FileText className="w-4 h-4" />
          Gerar Cotação
        </Button>
        <Button
          onClick={() => handleAtender('ordem')}
          className="bg-purple-500 hover:bg-purple-600 text-white gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          Gerar Ordem de Compra
        </Button>
        <Button
          onClick={() => handleAtender('sem_compras')}
          variant="outline"
          className="border-gray-700 text-gray-400 gap-2"
        >
          <PackageCheck className="w-4 h-4" />
          Atender Sem Compras
        </Button>
      </div>

      <Dialog open={dialogAtender} onOpenChange={setDialogAtender}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {tipoAtendimento === 'cotacao' && 'Gerar Cotação'}
              {tipoAtendimento === 'ordem' && 'Gerar Ordem de Compra'}
              {tipoAtendimento === 'sem_compras' && 'Atender Sem Compras'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Selecione os itens a serem atendidos:</p>
            
            <div className="overflow-x-auto border border-gray-800 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-gray-400">Item</TableHead>
                    <TableHead className="text-gray-400">Un</TableHead>
                    <TableHead className="text-gray-400 text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensDisponiveis.map((item, index) => {
                    const itemIndex = requisicao.itens.indexOf(item);
                    return (
                      <TableRow key={itemIndex} className="border-gray-800">
                        <TableCell>
                          <Checkbox
                            checked={itensSelecionados.includes(itemIndex)}
                            onCheckedChange={() => toggleItem(itemIndex)}
                          />
                        </TableCell>
                        <TableCell className="text-white">{item.descricao}</TableCell>
                        <TableCell className="text-gray-400">{item.unidade}</TableCell>
                        <TableCell className="text-white text-right">{item.quantidade_solicitada}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {tipoAtendimento === 'sem_compras' && (
              <div>
                <Label className="text-gray-400">Previsão de Entrega (opcional)</Label>
                <Input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button
                variant="outline"
                onClick={() => setDialogAtender(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarAtendimento}
                disabled={itensSelecionados.length === 0}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}