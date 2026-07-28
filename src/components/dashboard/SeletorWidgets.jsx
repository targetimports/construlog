import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Minus } from 'lucide-react';

const WIDGETS_DISPONIBLES = [
  { id: 'kpi_obras_ativas', nome: 'Obras Ativas', categoria: 'KPIs', tamanho: 'pequeno' },
  { id: 'kpi_contas_pagar', nome: 'Contas a Pagar', categoria: 'KPIs', tamanho: 'pequeno' },
  { id: 'kpi_contas_receber', nome: 'Contas a Receber', categoria: 'KPIs', tamanho: 'pequeno' },
  { id: 'kpi_saldo_caixa', nome: 'Saldo em Caixa', categoria: 'KPIs', tamanho: 'pequeno' },
  { id: 'kpi_custos_periodo', nome: 'Custos do Período', categoria: 'KPIs', tamanho: 'pequeno' },
  
  { id: 'grafico_fluxo_caixa', nome: 'Fluxo de Caixa', categoria: 'Gráficos', tamanho: 'grande' },
  { id: 'grafico_obras_status', nome: 'Obras por Status', categoria: 'Gráficos', tamanho: 'medio' },
  { id: 'grafico_custos_categoria', nome: 'Custos por Categoria', categoria: 'Gráficos', tamanho: 'medio' },
  
  { id: 'lista_obras_ativas', nome: 'Minhas Obras Ativas', categoria: 'Listas', tamanho: 'medio' },
  { id: 'lista_contas_vencidas', nome: 'Contas Vencidas', categoria: 'Listas', tamanho: 'pequeno' },
  { id: 'lista_requisicoes_pendentes', nome: 'Requisições Pendentes', categoria: 'Listas', tamanho: 'medio' },
  { id: 'lista_viagens_hoje', nome: 'Viagens de Hoje', categoria: 'Listas', tamanho: 'pequeno' },
  { id: 'lista_alertas_criticos', nome: 'Alertas Críticos', categoria: 'Listas', tamanho: 'pequeno' },
  
  { id: 'timeline_marcos_obra', nome: 'Marcos da Obra', categoria: 'Timeline', tamanho: 'grande' },
  { id: 'tabela_fornecedores', nome: 'Fornecedores', categoria: 'Tabelas', tamanho: 'grande' },
  { id: 'mapa_frota', nome: 'Mapa de Frota', categoria: 'Mapas', tamanho: 'grande' },
];

export default function SeletorWidgets({ open, onClose, widgetsAtivos, onAdicionar, onRemover }) {
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todos');

  const categorias = ['Todos', ...new Set(WIDGETS_DISPONIBLES.map(w => w.categoria))];
  
  const widgetsFiltrados = WIDGETS_DISPONIBLES.filter(w => {
    const matchBusca = w.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaSelecionada === 'Todos' || w.categoria === categoriaSelecionada;
    return matchBusca && matchCategoria;
  });

  const widgetsAdicionadosIds = widgetsAtivos.map(w => w.tipo);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar / Remover Widgets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar widgets..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtro por Categoria */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaSelecionada(cat)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
                  categoriaSelecionada === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {widgetsFiltrados.map(widget => {
              const isAdicionado = widgetsAdicionadosIds.includes(widget.id);
              
              return (
                <div
                  key={widget.id}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    isAdicionado
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{widget.nome}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {widget.categoria}
                        </span>
                        <span className="text-xs bg-amber-100 px-2 py-1 rounded text-amber-800">
                          {widget.tamanho}
                        </span>
                      </div>
                    </div>

                    {isAdicionado ? (
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => onRemover(widget.id)}
                        className="h-8 w-8 flex-shrink-0"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="default"
                        onClick={() => onAdicionar(widget)}
                        className="h-8 w-8 flex-shrink-0 bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {widgetsFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum widget encontrado</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}