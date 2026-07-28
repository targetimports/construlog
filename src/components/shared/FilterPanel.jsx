import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

export default function FilterPanel({
  open,
  onClose,
  filters = {},
  onFilterChange,
  onFiltersChange,
  onClear,
  filterConfig,
  config,
}) {
  const resolvedConfig = filterConfig || config || [];

  const handleChange = (key, value) => {
    if (onFilterChange) onFilterChange(key, value);
    if (onFiltersChange) onFiltersChange({ ...filters, [key]: value });
  };

  const renderField = (cfg) => {
    if (cfg.type === 'text') {
      return (
        <Input
          placeholder={cfg.placeholder || 'Digite...'}
          value={filters[cfg.key] || ''}
          onChange={(e) => handleChange(cfg.key, e.target.value)}
        />
      );
    }
    if (cfg.type === 'number') {
      return (
        <Input
          type="number"
          placeholder={cfg.placeholder || 'Digite...'}
          value={filters[cfg.key] || ''}
          onChange={(e) => handleChange(cfg.key, e.target.value ? parseFloat(e.target.value) : '')}
        />
      );
    }
    if (cfg.type === 'date') {
      return (
        <Input
          type="date"
          value={filters[cfg.key] || ''}
          onChange={(e) => handleChange(cfg.key, e.target.value)}
        />
      );
    }
    if (cfg.type === 'combobox') {
      return (
        <ComboboxBusca
          options={cfg.options || []}
          value={filters[cfg.key] || ''}
          onSelect={(value) => handleChange(cfg.key, value)}
          placeholder={cfg.placeholder || 'Selecione...'}
          searchPlaceholder={cfg.searchPlaceholder || 'Buscar...'}
          emptyMessage={cfg.emptyMessage || 'Nada encontrado.'}
          className="h-10"
        />
      );
    }
    if (cfg.type === 'select') {
      return (
        <Select
          value={filters[cfg.key] || ''}
          onValueChange={(value) => handleChange(cfg.key, value === '__all__' ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={cfg.placeholder || 'Selecione...'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {(cfg.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (cfg.type === 'daterange') {
      return (
        <div className="flex gap-2">
          <Input
            type="date"
            value={filters[`${cfg.key}_from`] || ''}
            onChange={(e) => handleChange(`${cfg.key}_from`, e.target.value)}
            placeholder="De"
          />
          <Input
            type="date"
            value={filters[`${cfg.key}_to`] || ''}
            onChange={(e) => handleChange(`${cfg.key}_to`, e.target.value)}
            placeholder="Até"
          />
        </div>
      );
    }
    return null;
  };

  const fieldsContent = (
    <div className="grid grid-cols-2 gap-4">
      {resolvedConfig.map((cfg) => (
        <div key={cfg.key} className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{cfg.label}</label>
          {renderField(cfg)}
        </div>
      ))}
    </div>
  );

  // Inline mode when open is not provided
  if (open === undefined) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        {fieldsContent}
        {onClear && (
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClear}>
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filtros Avançados</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {fieldsContent}
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={onClear}>
            <X className="w-4 h-4 mr-2" />
            Limpar Filtros
          </Button>
          <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}