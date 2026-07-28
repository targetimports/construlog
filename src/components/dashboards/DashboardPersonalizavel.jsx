import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Plus, Trash2 } from 'lucide-react';

export default function DashboardPersonalizavel({ obra_id }) {
  const [widgets, setWidgets] = useState([]);
  const [editMode, setEditMode] = useState(false);

  // Carregar preferências do usuário
  const { data: preferencias } = useQuery({
    queryKey: ['dashboard-prefs', obra_id],
    queryFn: async () => {
      const user = await base44.auth.me();
      const contexto = await base44.entities.ContextoUsuario.filter({
        user_email: user.email,
        tipo_contexto: 'dashboard'
      });
      return contexto?.[0] || { widgets_order: [] };
    }
  });

  // Widgets disponíveis
  const widgetsDisponiveis = [
    { id: 'kpi-financeiro', titulo: 'KPI Financeiro', componente: 'KPIFinanceiro' },
    { id: 'estoque-critico', titulo: 'Estoque Crítico', componente: 'EstoqueCritico' },
    { id: 'progresso-obra', titulo: 'Progresso da Obra', componente: 'ProgressoObra' },
    { id: 'alertas-recentes', titulo: 'Alertas Recentes', componente: 'AlertasRecentes' },
    { id: 'medicoes-pendentes', titulo: 'Medições Pendentes', componente: 'MedicoesPendentes' }
  ];

  const adicionarWidget = (widgetId) => {
    if (!widgets.find(w => w.id === widgetId)) {
      const widget = widgetsDisponiveis.find(w => w.id === widgetId);
      setWidgets([...widgets, widget]);
    }
  };

  const removerWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <Button
          variant={editMode ? 'default' : 'outline'}
          onClick={() => setEditMode(!editMode)}
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          {editMode ? 'Pronto' : 'Personalizar'}
        </Button>
      </div>

      {editMode && (
        <Card>
          <CardHeader>
            <CardTitle>Widgets Disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {widgetsDisponiveis.map(w => (
              <Button
                key={w.id}
                variant={widgets.find(x => x.id === w.id) ? 'default' : 'outline'}
                onClick={() => widgets.find(x => x.id === w.id) ? removerWidget(w.id) : adicionarWidget(w.id)}
                className="gap-2 justify-start"
              >
                {widgets.find(x => x.id === w.id) ? (
                  <>
                    <Trash2 className="w-4 h-4" /> {w.titulo}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> {w.titulo}
                  </>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map(widget => (
          <div key={widget.id} className="relative">
            {editMode && (
              <button
                onClick={() => removerWidget(widget.id)}
                className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded text-red-600 z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{widget.titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-gray-500 text-sm">
                  Carregando {widget.titulo}...
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}