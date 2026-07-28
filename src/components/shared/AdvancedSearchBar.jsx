import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Filter, Save, Trash2, ChevronDown, X, Clock } from 'lucide-react';

export default function AdvancedSearchBar({
  searchValue,
  onSearchChange,
  onFilterClick,
  filters,
  savedFilters = [],
  onLoadPreset,
  onDeletePreset,
  onSavePreset,
  hasActiveFilters,
  enablePresets = true // quando false, esconde os botões de Presets e Salvar
}) {
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName);
      setPresetName('');
      setShowSaveDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Buscar..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          onClick={onFilterClick}
          variant={hasActiveFilters ? 'default' : 'outline'}
          className={hasActiveFilters ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros
          {hasActiveFilters && <span className="ml-2 bg-white text-blue-600 rounded-full px-2 text-xs font-bold">●</span>}
        </Button>

        {enablePresets && (
          <>
            <Button
              onClick={() => setShowPresets(!showPresets)}
              variant="outline"
              className="relative"
            >
              <Clock className="w-4 h-4 mr-2" />
              Presets
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>

            <Button
              onClick={() => setShowSaveDialog(true)}
              variant="outline"
              title="Salvar filtros atuais como preset"
            >
              <Save className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Presets Dropdown */}
      {enablePresets && showPresets && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
          <div className="p-2">
            {(savedFilters?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500 p-2">Nenhum preset salvo</p>
            ) : (
              <div className="space-y-1">
                {(savedFilters || []).map(preset => (
                  <div key={preset.id} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded">
                    <button
                      onClick={() => {
                        onLoadPreset(preset.id);
                        setShowPresets(false);
                      }}
                      className="flex-1 text-left text-sm text-gray-700 hover:text-blue-600"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => onDeletePreset(preset.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Filtros como Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do preset (ex: 'Meus Favoritos')"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}