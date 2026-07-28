import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Zap, Building2, DollarSign, FileText, Truck, 
  Package, Users, BarChart3, Plus, Trash2, ClipboardList, Clipboard
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const availableShortcuts = [
  { iconName: 'Building2', label: 'Obras', page: 'Obras', color: 'bg-blue-500' },
  { iconName: 'DollarSign', label: 'Financeiro', page: 'Financeiro', color: 'bg-green-500' },
  { iconName: 'FileText', label: 'Orçamentos', page: 'Orcamentos', color: 'bg-purple-500' },
  { iconName: 'Truck', label: 'Logística', page: 'Frota', color: 'bg-orange-500' },
  { iconName: 'Package', label: 'Estoque', page: 'Estoque', color: 'bg-yellow-500' },
  { iconName: 'Users', label: 'Mão de Obra', page: 'GestaoMaoDeObra', color: 'bg-red-500' },
  { iconName: 'BarChart3', label: 'BI', page: 'BI', color: 'bg-indigo-500' },
  { iconName: 'Clipboard', label: 'Medições', page: 'Medicoes', color: 'bg-cyan-500' },
];

const iconMap = {
  Building2, DollarSign, FileText, Truck, Package, Users, BarChart3, Clipboard: ClipboardList, Zap, Plus, Trash2
};

export default function CustomShortcutsPanel() {
  const [selectedShortcuts, setSelectedShortcuts] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const queryClient = useQueryClient();
  const user = base44.auth.me();

  // Carregar atalhos do usuário
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const userData = await base44.auth.me();
        if (userData?.shortcut_customizado) {
          setSelectedShortcuts(JSON.parse(userData.shortcut_customizado));
        }
      } catch (error) {
        console.error('Erro ao carregar atalhos:', error);
      }
    };
    loadShortcuts();
  }, []);

  const handleAddShortcut = (shortcut) => {
    if (!selectedShortcuts.find(s => s.page === shortcut.page)) {
      setSelectedShortcuts([...selectedShortcuts, shortcut]);
    }
  };

  const handleRemoveShortcut = (page) => {
    setSelectedShortcuts(selectedShortcuts.filter(s => s.page !== page));
  };

  const handleSave = async () => {
    try {
      await base44.auth.updateMe({
        shortcut_customizado: JSON.stringify(selectedShortcuts)
      });
      setShowConfig(false);
    } catch (error) {
      console.error('Erro ao salvar atalhos:', error);
    }
  };

  const unselectedShortcuts = availableShortcuts.filter(
    s => !selectedShortcuts.find(sel => sel.page === s.page)
  );

  return (
    <div className="fixed left-6 top-20 w-64 z-50">
      {/* Panel de Atalhos */}
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-900">Atalhos Rápidos</h3>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1 hover:bg-blue-200 rounded-lg transition-all"
            title="Configurar atalhos"
          >
            <Plus className="w-4 h-4 text-blue-600" />
          </button>
        </div>

        {/* Atalhos Selecionados */}
        <div className="p-3 space-y-1 max-h-96 overflow-y-auto">
          {selectedShortcuts.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">
              Clique em + para adicionar atalhos
            </p>
          ) : (
            selectedShortcuts.map((shortcut) => {
              const Icon = iconMap[shortcut.iconName];
              return (
                <Link
                  key={shortcut.page}
                  to={createPageUrl(shortcut.page)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all group"
                >
                  <div className={`${shortcut.color} text-white p-1.5 rounded`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                    {shortcut.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveShortcut(shortcut.page);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </Link>
              );
            })
          )}
        </div>

        {/* Config Panel */}
        {showConfig && (
          <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-2 max-h-64 overflow-y-auto">
            {unselectedShortcuts.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">
                Todos os atalhos adicionados
              </p>
            ) : (
              unselectedShortcuts.map((shortcut) => {
                const Icon = iconMap[shortcut.iconName];
                return (
                  <button
                    key={shortcut.page}
                    onClick={() => handleAddShortcut(shortcut)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-blue-200 transition-all text-left"
                  >
                    <div className={`${shortcut.color} text-white p-1.5 rounded`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-700">
                      {shortcut.label}
                    </span>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </button>
                );
              })
            )}

            {/* Botão Salvar */}
            {unselectedShortcuts.length > 0 && (
              <button
                onClick={handleSave}
                className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg text-sm transition-all"
              >
                Salvar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}