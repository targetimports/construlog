import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function ImportarDoOrcamento({ obraId, onImportar }) {
  const [dialog, setDialog] = useState(false);
  const [etapaSelecionada, setEtapaSelecionada] = useState('');
  const [search, setSearch] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState([]);

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId && dialog
  });

  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento', orcamentos[0]?.id],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentos[0]?.id }),
    enabled: orcamentos.length > 0 && dialog
  });

  const etapas = [...new Set(itensOrcamento.map(i => i.etapa).filter(Boolean))];

  const itensFiltrados = itensOrcamento.filter(item => {
    const matchEtapa = !etapaSelecionada || item.etapa === etapaSelecionada;
    const matchSearch = !search || 
      item.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      item.codigo?.toLowerCase().includes(search.toLowerCase());
    return matchEtapa && matchSearch;
  });

  const toggleItem = (item) => {
    const existe = itensSelecionados.find(s => s.id === item.id);
    if (existe) {
      setItensSelecionados(itensSelecionados.filter(s => s.id !== item.id));
    } else {
      setItensSelecionados([...itensSelecionados, item]);
    }
  };

  const confirmarImportacao = () => {
    const itensParaImportar = itensSelecionados.map(item => ({
      insumo_id: item.insumo_id,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade_solicitada: item.quantidade || 1,
      quantidade_aprovada: item.quantidade || 1,
      quantidade_recebida: 0,
      valor_estimado: item.custo_unitario || 0,
      item_avulso: false,
      status: 'em_aberto'
    }));
    
    onImportar(itensParaImportar);
    setItensSelecionados([]);
    setDialog(false);
  };

  return (
    <>
      <Button
        onClick={() => setDialog(true)}
        variant="outline"
        className="border-gray-700 text-gray-400 gap-2"
      >
        <Download className="w-4 h-4" />
        Importar do Orçamento
      </Button>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Importar Itens do Orçamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Filtros */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select value={etapaSelecionada} onValueChange={setEtapaSelecionada}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800">
                    <SelectItem value={null}>Todas as etapas</SelectItem>
                    {etapas.map(etapa => (
                      <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Lista de Itens */}
            <div className="flex-1 overflow-auto border border-gray-800 rounded-lg">
              <Table className="min-w-[600px]">
                <TableHeader className="sticky top-0 bg-gray-900">
                  <TableRow className="border-gray-800">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-gray-400">Item</TableHead>
                    <TableHead className="text-gray-400">Etapa</TableHead>
                    <TableHead className="text-gray-400 text-right">Qtd</TableHead>
                    <TableHead className="text-gray-400 text-right">Un</TableHead>
                    <TableHead className="text-gray-400 text-right">Custo Un.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.map(item => {
                    const selecionado = itensSelecionados.find(s => s.id === item.id);
                    return (
                      <TableRow 
                        key={item.id} 
                        className={cn(
                          "border-gray-800 cursor-pointer",
                          selecionado && "bg-blue-500/10"
                        )}
                        onClick={() => toggleItem(item)}
                      >
                        <TableCell>
                          <Checkbox checked={!!selecionado} />
                        </TableCell>
                        <TableCell className="text-white">{item.descricao}</TableCell>
                        <TableCell className="text-gray-400">{item.etapa}</TableCell>
                        <TableCell className="text-white text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-gray-400 text-right">{item.unidade}</TableCell>
                        <TableCell className="text-emerald-400 text-right">
                          {(item.custo_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <span className="text-gray-400 text-sm">
                {itensSelecionados.length} itens selecionados
              </span>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDialog(false)}
                  className="border-gray-700 text-gray-400"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmarImportacao}
                  disabled={itensSelecionados.length === 0}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  Importar ({itensSelecionados.length})
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}