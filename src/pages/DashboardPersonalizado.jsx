import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit2, Plus, Save, X, Settings } from 'lucide-react';
import { toast } from 'sonner';
import SeletorWidgets from '@/components/dashboard/SeletorWidgets';
import WidgetsGrid from '@/components/dashboard/WidgetsGrid';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function DashboardPersonalizado() {
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showSeletorWidgets, setShowSeletorWidgets] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);

  // Fetch user
  React.useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  // Fetch dashboards do usuário
  const { data: dashboards, isLoading: loadingDashboards, refetch: refetchDashboards } = useQuery({
    queryKey: ['dashboards-usuario', user?.email],
    queryFn: () => user?.email ? base44.entities.DashboardPersonalizado.filter({ user_email: user.email }) : [],
    enabled: !!user?.email,
  });

  // Fetch dashboard padrão ou primeiro dashboard
  const { data: dashboardAtual } = useQuery({
    queryKey: ['dashboard-atual', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      // Tenta encontrar dashboard padrão
      const padrao = dashboards?.find(d => d.eh_padrao);
      if (padrao) {
        setSelectedDashboard(padrao);
        setWidgets(padrao.widgets || []);
        return padrao;
      }
      
      // Se não houver, usa o primeiro ou cria um novo
      if (dashboards?.length > 0) {
        const primeiro = dashboards[0];
        setSelectedDashboard(primeiro);
        setWidgets(primeiro.widgets || []);
        return primeiro;
      }
      
      // Cria dashboard padrão
      const newDashboard = await base44.entities.DashboardPersonalizado.create({
        user_email: user.email,
        nome: 'Meu Dashboard',
        eh_padrao: true,
        widgets: [],
      });
      setSelectedDashboard(newDashboard);
      return newDashboard;
    },
    enabled: !!user?.email && dashboards?.length > 0,
  });

  // Salvar widgets
  const saveMutation = useMutation({
    mutationFn: async (newWidgets) => {
      if (!selectedDashboard) return;
      
      await base44.entities.DashboardPersonalizado.update(selectedDashboard.id, {
        widgets: newWidgets,
      });
    },
    onSuccess: () => {
      toast.success('Dashboard salvo com sucesso!');
      setEditMode(false);
      refetchDashboards();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Criar novo dashboard
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email || !newDashboardName) return;
      
      const newDashboard = await base44.entities.DashboardPersonalizado.create({
        user_email: user.email,
        nome: newDashboardName,
        eh_padrao: false,
        widgets: [],
      });
      return newDashboard;
    },
    onSuccess: () => {
      toast.success('Dashboard criado!');
      setShowNewDashboard(false);
      setNewDashboardName('');
      refetchDashboards();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Deletar dashboard
  const deleteMutation = useMutation({
    mutationFn: async (dashboardId) => {
      await base44.entities.DashboardPersonalizado.delete(dashboardId);
    },
    onSuccess: () => {
      toast.success('Dashboard deletado!');
      refetchDashboards();
      setSelectedDashboard(null);
      setWidgets([]);
    },
  });

  const handleAddWidget = (widget) => {
    const newWidget = {
      widget_id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tipo: widget.id,
      tamanho: widget.tamanho,
      posicao_ordem: widgets.length,
      configuracoes: {},
    };
    setWidgets([...widgets, newWidget]);
  };

  const handleRemoveWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.widget_id !== widgetId));
  };

  const handleReorderWidgets = (newWidgets) => {
    setWidgets(newWidgets.map((w, idx) => ({ ...w, posicao_ordem: idx })));
  };

  const handleSave = () => {
    saveMutation.mutate(widgets);
  };

  if (!user || loadingDashboards) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto"><PageSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Meus Dashboards</h1>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button
                  onClick={() => setShowSeletorWidgets(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Widget
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
                <Button
                  onClick={() => {
                    setEditMode(false);
                    refetchDashboards();
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setEditMode(true)}
                  variant="outline"
                >
                  <Edit2 className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button
                  onClick={() => setShowNewDashboard(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Novo Dashboard
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Seletor de Dashboards */}
        {dashboards && dashboards.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dashboards.map(dashboard => (
              <button
                key={dashboard.id}
                onClick={() => {
                  setSelectedDashboard(dashboard);
                  setWidgets(dashboard.widgets || []);
                }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedDashboard?.id === dashboard.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {dashboard.nome}
                {editMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dashboards.length > 1) {
                        deleteMutation.mutate(dashboard.id);
                      } else {
                        toast.error('Você deve manter pelo menos um dashboard');
                      }
                    }}
                    className="ml-1 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Grid de Widgets */}
        {selectedDashboard && widgets.length > 0 ? (
          <WidgetsGrid
            widgets={widgets}
            onRemove={handleRemoveWidget}
            onReorder={handleReorderWidgets}
            editMode={editMode}
          />
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {editMode
                  ? 'Clique em "Adicionar Widget" para começar'
                  : 'Nenhum widget configurado. Clique em "Editar" para adicionar widgets'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog: Novo Dashboard */}
      <Dialog open={showNewDashboard} onOpenChange={setShowNewDashboard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do dashboard"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setShowNewDashboard(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newDashboardName || createMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Seletor de Widgets */}
      <SeletorWidgets
        open={showSeletorWidgets}
        onClose={() => setShowSeletorWidgets(false)}
        widgetsAtivos={widgets}
        onAdicionar={handleAddWidget}
        onRemover={handleRemoveWidget}
      />
    </div>
  );
}