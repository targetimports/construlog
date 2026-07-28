import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, File, Database, Briefcase, ChevronRight } from 'lucide-react';

export default function GlobalSearch({ open, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-search'],
    queryFn: () => base44.entities.Obra.list('-created_date', 100),
    enabled: open
  });

  const { data: composicoes = [] } = useQuery({
    queryKey: ['composicoes-search'],
    queryFn: () => base44.entities.Composicao.list('-created_date', 200),
    enabled: open
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-search'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 200),
    enabled: open
  });

  // Busca
  const results = React.useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    const items = [];

    // Obras
    obras.forEach(obra => {
      if (
        obra.nome?.toLowerCase().includes(term) ||
        obra.codigo?.toLowerCase().includes(term) ||
        obra.cliente?.toLowerCase().includes(term)
      ) {
        items.push({
          type: 'obra',
          id: obra.id,
          title: obra.nome,
          subtitle: obra.codigo,
          icon: Briefcase,
          action: () => navigate(createPageUrl('ObraDetalhes') + `?id=${obra.id}`)
        });
      }
    });

    // Composições
    composicoes.forEach(comp => {
      if (
        comp.codigo?.toLowerCase().includes(term) ||
        comp.descricao?.toLowerCase().includes(term)
      ) {
        items.push({
          type: 'composicao',
          id: comp.id,
          title: comp.descricao,
          subtitle: comp.codigo,
          icon: Database,
          action: () => navigate(createPageUrl('Insumos'))
        });
      }
    });

    // Insumos
    insumos.forEach(ins => {
      if (
        ins.codigo?.toLowerCase().includes(term) ||
        ins.descricao?.toLowerCase().includes(term)
      ) {
        items.push({
          type: 'insumo',
          id: ins.id,
          title: ins.descricao,
          subtitle: ins.codigo,
          icon: File,
          action: () => navigate(createPageUrl('Insumos'))
        });
      }
    });

    return items.slice(0, 10);
  }, [searchTerm, obras, composicoes, insumos, navigate]);

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        results[selectedIndex].action();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, onClose]);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);

  const typeLabels = {
    obra: { label: 'Obra', color: 'bg-blue-100 text-blue-700' },
    composicao: { label: 'Composição', color: 'bg-emerald-100 text-emerald-700' },
    insumo: { label: 'Insumo', color: 'bg-amber-100 text-amber-700' }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0">
        <div className="border-b border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar obras, composições, insumos..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
              className="pl-10 text-lg border-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {searchTerm.length < 2 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Digite ao menos 2 caracteres para buscar
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum resultado encontrado
            </div>
          ) : (
            <div className="py-2">
              {results.map((item, index) => {
                const Icon = item.icon;
                const typeInfo = typeLabels[item.type];

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.title}
                        </p>
                        <Badge className={typeInfo.color}>
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{item.subtitle}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-xs text-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>↑↓ Navegar</span>
            <span>↵ Selecionar</span>
            <span>Esc Fechar</span>
          </div>
          <span className="text-gray-400">Ctrl+K para abrir</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}