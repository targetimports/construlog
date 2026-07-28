import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Trash2, Search, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const statusItemConfig = {
  em_aberto: { label: 'Em Aberto', color: 'bg-gray-500/10 text-gray-400' },
  em_cotacao: { label: 'Em Cotação', color: 'bg-blue-500/10 text-blue-400' },
  em_compra: { label: 'Em Compra', color: 'bg-purple-500/10 text-purple-400' },
  a_receber: { label: 'A Receber', color: 'bg-amber-500/10 text-amber-400' },
  recebido_parcial: { label: 'Recebido Parcial', color: 'bg-orange-500/10 text-orange-400' },
  recebido: { label: 'Recebido', color: 'bg-emerald-500/10 text-emerald-400' },
  recusado: { label: 'Recusado', color: 'bg-red-500/10 text-red-400' }
};

export default function ItemRequisicao({ itens = [], onItensChange, disabled = false }) {
  const [dialogInsumos, setDialogInsumos] = useState(false);
  const [dialogAvulso, setDialogAvulso] = useState(false);
  const [searchInsumo, setSearchInsumo] = useState('');
  const [insumosSelecionados, setInsumosSelecionados] = useState([]);
  const [itemAvulso, setItemAvulso] = useState({ descricao: '', unidade: 'un', quantidade_solicitada: 1 });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list()
  });

  const insumosFiltrados = insumos.filter(i =>
    i.descricao?.toLowerCase().includes(searchInsumo.toLowerCase()) ||
    i.codigo?.toLowerCase().includes(searchInsumo.toLowerCase())
  );

  const toggleInsumo = (insumo) => {
    const jaExiste = insumosSelecionados.find(s => s.id === insumo.id);
    if (jaExiste) {
      setInsumosSelecionados(insumosSelecionados.filter(s => s.id !== insumo.id));
    } else if (insumosSelecionados.length < 10) {
      setInsumosSelecionados([...insumosSelecionados, insumo]);
    }
  };

  const incluirInsumos = () => {
    const novosItens = insumosSelecionados.map(insumo => ({
      insumo_id: insumo.id,
      descricao: insumo.descricao,
      unidade: insumo.unidade,
      quantidade_solicitada: 1,
      quantidade_aprovada: 1,
      quantidade_recebida: 0,
      valor_estimado: insumo.preco_unitario || 0,
      item_avulso: false,
      status: 'em_aberto'
    }));
    onItensChange([...itens, ...novosItens]);
    setInsumosSelecionados([]);
    setDialogInsumos(false);
  };

  const incluirItemAvulso = () => {
    if (!itemAvulso.descricao) return;
    const novoItem = {
      ...itemAvulso,
      item_avulso: true,
      status: 'em_aberto',
      quantidade_aprovada: itemAvulso.quantidade_solicitada,
      quantidade_recebida: 0
    };
    onItensChange([...itens, novoItem]);
    setItemAvulso({ descricao: '', unidade: 'un', quantidade_solicitada: 1 });
    setDialogAvulso(false);
  };

  const removerItem = (index) => {
    onItensChange(itens.filter((_, i) => i !== index));
  };

  const atualizarQuantidade = (index, campo, valor) => {
    const novosItens = [...itens];
    novosItens[index][campo] = parseFloat(valor) || 0;
    onItensChange(novosItens);
  };

  return (
    <div className="space-y-4">
      {!disabled && (
        <div className="flex gap-3">
          <Button
            onClick={() => setDialogInsumos(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Item
          </Button>
          <Button
            onClick={() => setDialogAvulso(true)}
            variant="outline"
            className="border-gray-700 text-gray-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Item Avulso
          </Button>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
          <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum item adicionado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">Item</TableHead>
                <TableHead className="text-gray-400">Un</TableHead>
                <TableHead className="text-gray-400 text-right">Qtd Solicitada</TableHead>
                <TableHead className="text-gray-400 text-right">Qtd Aprovada</TableHead>
                <TableHead className="text-gray-400 text-right">Qtd Recebida</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                {!disabled && <TableHead className="text-gray-400"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item, index) => {
                const statusInfo = statusItemConfig[item.status] || statusItemConfig.em_aberto;
                return (
                  <TableRow key={index} className="border-gray-800">
                    <TableCell className="text-white">
                      {item.descricao}
                      {item.item_avulso && (
                        <Badge className="ml-2 bg-purple-500/10 text-purple-400 border-purple-500/20">Avulso</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400">{item.unidade}</TableCell>
                    <TableCell className="text-white text-right">
                      {disabled ? (
                        item.quantidade_solicitada
                      ) : (
                        <Input
                          type="number"
                          value={item.quantidade_solicitada}
                          onChange={(e) => atualizarQuantidade(index, 'quantidade_solicitada', e.target.value)}
                          className="w-24 bg-gray-800 border-gray-700 text-white text-right"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-emerald-400 text-right font-semibold">
                      {item.quantidade_aprovada || 0}
                    </TableCell>
                    <TableCell className="text-blue-400 text-right">
                      {item.quantidade_recebida || 0}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border", statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    {!disabled && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removerItem(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Selecionar Insumos */}
      <Dialog open={dialogInsumos} onOpenChange={setDialogInsumos}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Selecionar Insumos do Catálogo</DialogTitle>
            <p className="text-gray-500 text-sm">Máximo 10 itens por vez</p>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar insumo por código ou descrição..."
                value={searchInsumo}
                onChange={(e) => setSearchInsumo(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg">
              <div className="space-y-2 p-2">
                {insumosFiltrados.map(insumo => {
                  const selecionado = insumosSelecionados.find(s => s.id === insumo.id);
                  return (
                    <div
                      key={insumo.id}
                      onClick={() => toggleInsumo(insumo)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        selecionado 
                          ? "bg-blue-500/20 border-blue-500/50" 
                          : "bg-gray-800 border-gray-700 hover:border-gray-600"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{insumo.descricao}</p>
                          <div className="flex gap-3 mt-1 text-sm">
                            {insumo.codigo && (
                              <span className="text-gray-400">Cód: {insumo.codigo}</span>
                            )}
                            <span className="text-gray-400">{insumo.unidade}</span>
                            {insumo.preco_unitario > 0 && (
                              <span className="text-emerald-400">
                                {insumo.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </div>
                        </div>
                        {selecionado && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-gray-400 text-sm">
                {insumosSelecionados.length} / 10 selecionados
              </span>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogInsumos(false);
                    setInsumosSelecionados([]);
                  }}
                  className="border-gray-700 text-gray-400"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={incluirInsumos}
                  disabled={insumosSelecionados.length === 0}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Incluir ({insumosSelecionados.length})
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Item Avulso */}
      <Dialog open={dialogAvulso} onOpenChange={setDialogAvulso}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Item Avulso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Descrição *</Label>
              <Input
                value={itemAvulso.descricao}
                onChange={(e) => setItemAvulso({ ...itemAvulso, descricao: e.target.value })}
                placeholder="Descreva o item..."
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Unidade *</Label>
                <Input
                  value={itemAvulso.unidade}
                  onChange={(e) => setItemAvulso({ ...itemAvulso, unidade: e.target.value })}
                  placeholder="ex: un, kg, m²"
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Quantidade *</Label>
                <Input
                  type="number"
                  value={itemAvulso.quantidade_solicitada}
                  onChange={(e) => setItemAvulso({ ...itemAvulso, quantidade_solicitada: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogAvulso(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={incluirItemAvulso}
                disabled={!itemAvulso.descricao || !itemAvulso.unidade}
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}