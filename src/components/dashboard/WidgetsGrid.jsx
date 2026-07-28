import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import KPIWorks from './widgets/KPIWorks';
import KPIAccountsPayable from './widgets/KPIAccountsPayable';
import KPIAccountsReceivable from './widgets/KPIAccountsReceivable';
import KPIBalance from './widgets/KPIBalance';
import KPIOperationalCosts from './widgets/KPIOperationalCosts';
import CashFlowChart from './widgets/CashFlowChart';
import WorksStatusChart from './widgets/WorksStatusChart';
import CostsByCategoryChart from './widgets/CostsByCategoryChart';
import ActiveWorksList from './widgets/ActiveWorksList';
import OverdueAccountsList from './widgets/OverdueAccountsList';
import PendingRequisitionsList from './widgets/PendingRequisitionsList';
import TodayTripsList from './widgets/TodayTripsList';
import CriticalAlertsList from './widgets/CriticalAlertsList';

const WIDGET_COMPONENTS = {
  'kpi_obras_ativas': KPIWorks,
  'kpi_contas_pagar': KPIAccountsPayable,
  'kpi_contas_receber': KPIAccountsReceivable,
  'kpi_saldo_caixa': KPIBalance,
  'kpi_custos_periodo': KPIOperationalCosts,
  'grafico_fluxo_caixa': CashFlowChart,
  'grafico_obras_status': WorksStatusChart,
  'grafico_custos_categoria': CostsByCategoryChart,
  'lista_obras_ativas': ActiveWorksList,
  'lista_contas_vencidas': OverdueAccountsList,
  'lista_requisicoes_pendentes': PendingRequisitionsList,
  'lista_viagens_hoje': TodayTripsList,
  'lista_alertas_criticos': CriticalAlertsList,
};

export default function WidgetsGrid({ widgets, onRemove, onReorder, editMode = false }) {
  const [draggedId, setDraggedId] = React.useState(null);

  const handleDragStart = (e, widgetId) => {
    if (!editMode) return;
    setDraggedId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetWidgetId) => {
    if (!editMode || !draggedId || draggedId === targetWidgetId) return;
    e.preventDefault();

    const draggedIndex = widgets.findIndex(w => w.widget_id === draggedId);
    const targetIndex = widgets.findIndex(w => w.widget_id === targetWidgetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newWidgets = [...widgets];
      [newWidgets[draggedIndex], newWidgets[targetIndex]] = [
        newWidgets[targetIndex],
        newWidgets[draggedIndex]
      ];
      onReorder(newWidgets);
    }
    setDraggedId(null);
  };

  const getSizeClasses = (tamanho) => {
    switch (tamanho) {
      case 'pequeno':
        return 'col-span-1 row-span-1';
      case 'grande':
        return 'col-span-2 row-span-2 md:col-span-2';
      case 'medio':
      default:
        return 'col-span-1 md:col-span-1';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max">
      {widgets.map((widget) => {
        const Component = WIDGET_COMPONENTS[widget.tipo];
        
        if (!Component) {
          return (
            <div
              key={widget.widget_id}
              className="bg-red-50 border border-red-300 rounded-lg p-4"
            >
              <p className="text-red-600 text-sm">Widget não encontrado: {widget.tipo}</p>
            </div>
          );
        }

        return (
          <div
            key={widget.widget_id}
            className={`${getSizeClasses(widget.tamanho)} transition-all ${
              draggedId === widget.widget_id ? 'opacity-50' : ''
            }`}
            draggable={editMode}
            onDragStart={(e) => handleDragStart(e, widget.widget_id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, widget.widget_id)}
          >
            <Card className={`h-full relative ${editMode ? 'ring-2 ring-blue-300' : ''}`}>
              {/* Header do Widget (edit mode) */}
              {editMode && (
                <div className="absolute top-0 left-0 right-0 flex items-center gap-2 bg-blue-50 border-b p-2 rounded-t-lg z-10">
                  <GripVertical className="w-4 h-4 text-blue-600 cursor-move flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 flex-1">Arrastar para reordenar</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemove(widget.widget_id)}
                    className="h-6 w-6"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Conteúdo do Widget */}
              <div className={editMode ? 'pt-10' : ''}>
                <Component config={widget.configuracoes} />
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}