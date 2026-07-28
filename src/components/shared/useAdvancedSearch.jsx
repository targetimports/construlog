import { useState, useCallback } from 'react';

export const useAdvancedSearch = (entityName, initialFilters = {}) => {
  const [filters, setFilters] = useState(initialFilters);
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [savedFilters, setSavedFilters] = useState(() => {
    const saved = localStorage.getItem(`filters_${entityName}`);
    return saved ? JSON.parse(saved) : [];
  });

  const applyFilter = useCallback((filterKey, filterValue) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterValue || undefined
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const saveFilterPreset = useCallback((presetName) => {
    const newPreset = {
      id: Date.now(),
      name: presetName,
      filters,
      sortBy,
      sortOrder
    };
    const updated = [...savedFilters, newPreset];
    setSavedFilters(updated);
    localStorage.setItem(`filters_${entityName}`, JSON.stringify(updated));
    return newPreset;
  }, [filters, sortBy, sortOrder, savedFilters, entityName]);

  const loadFilterPreset = useCallback((presetId) => {
    const preset = savedFilters.find(p => p.id === presetId);
    if (preset) {
      setFilters(preset.filters);
      setSortBy(preset.sortBy);
      setSortOrder(preset.sortOrder);
    }
  }, [savedFilters]);

  const deleteFilterPreset = useCallback((presetId) => {
    const updated = savedFilters.filter(p => p.id !== presetId);
    setSavedFilters(updated);
    localStorage.setItem(`filters_${entityName}`, JSON.stringify(updated));
  }, [savedFilters, entityName]);

  const toggleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  const getCleanFilters = useCallback(() => {
    return Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
  }, [filters]);

  return {
    filters,
    applyFilter,
    clearFilters,
    sortBy,
    sortOrder,
    toggleSort,
    savedFilters,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    getCleanFilters,
    hasActiveFilters: Object.keys(getCleanFilters()).length > 0
  };
};