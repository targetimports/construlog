import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, DollarSign, Users, Package, UtensilsCrossed, 
  Fuel, Truck, Hotel, Receipt, CreditCard, UserCircle, 
  BarChart3, ChevronLeft, Menu, X, Building2, ClipboardList, Target
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const obraSubmenuItems = [
  { id: 'resumo', label: 'Resumo', icon: FileText, path: 'resumo' },
  { id: 'notas-fiscais', label: 'Notas Fiscais', icon: Receipt, path: 'notas-fiscais', badge: 'Novo' },
  { id: 'mao-de-obra', label: 'Mão de Obra', icon: Users, path: 'mao-de-obra', badge: 'Novo' },
  { id: 'material', label: 'Material', icon: Package, path: 'material', badge: 'Novo' },
  { id: 'alimentacao', label: 'Alimentação', icon: UtensilsCrossed, path: 'alimentacao', badge: 'Novo' },
  { id: 'aluguel-combustivel', label: 'Aluguel/Combustível', icon: Fuel, path: 'aluguel-combustivel', badge: 'Novo' },
  { id: 'fretes', label: 'Fretes', icon: Truck, path: 'fretes', badge: 'Novo' },
  { id: 'estadias', label: 'Estadias', icon: Hotel, path: 'estadias', badge: 'Novo' },
  { id: 'impostos', label: 'Impostos', icon: CreditCard, path: 'impostos', badge: 'Novo' },
  { id: 'retiradas', label: 'Retiradas', icon: DollarSign, path: 'retiradas', badge: 'Novo' },
  { id: 'pessoas', label: 'Pessoas', icon: UserCircle, path: 'pessoas', badge: 'Novo' },
  { id: 'bi-compras', label: 'BI Compras', icon: BarChart3, path: 'bi-compras' }
];

const acoesRapidas = [
  { id: 'obras-todas', label: 'Todas as Obras', icon: FileText, page: 'Obras' },
  { id: 'obras-gestao', label: 'Gestão de Obras', icon: BarChart3, page: 'GestaoObras' },
  { id: 'obras-diario', label: 'Diário de Obra', icon: FileText, page: 'DiarioObra' },
  { id: 'obras-engenharia', label: 'Engenharia & Qualidade', icon: FileText, page: 'Engenharia' },
  { id: 'obras-mapa-medicoes', label: 'Mapa de Medições', icon: FileText, page: 'MapaMedicoes' },
  { id: 'obras-medicoes', label: 'Medições', icon: FileText, page: 'Medicoes' },
  { id: 'obras-medicao-analitica', label: 'Medição Analítica', icon: FileText, page: 'MedicaoObraAnalitica', badge: 'Novo' },
  { id: 'obras-medicao-contratos', label: 'Medição de Contratos', icon: FileText, page: 'MedicaoContratos' },
  { id: 'obras-arquivos', label: 'Gerenciar Arquivos', icon: FileText, page: 'GerenciarArquivos' },
  { id: 'obras-analise-ia', label: 'Análise por Obra (IA)', icon: FileText, page: 'GestaoObrasAvancada', badge: 'IA' }
];

export default function ObraLayout({ children }) {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: obra, isLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }).then(r => r[0]),
    enabled: !!obraId
  });

  // Salvar última obra acessada
  useEffect(() => {
    if (obraId) {
      localStorage.setItem('lastObraId', obraId);
    }
  }, [obraId]);

  // Redirecionar para /resumo se estiver na raiz
  useEffect(() => {
    if (location.pathname === `/obras/${obraId}` || location.pathname === `/obras/${obraId}/`) {
      navigate(`/obras/${obraId}/resumo`, { replace: true });
    }
  }, [location.pathname, obraId, navigate]);

  const currentSection = location.pathname.split('/').pop();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Obra não encontrada</h2>
        <Button onClick={() => navigate('/obras')} className="mt-4">
          Voltar para Obras
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Cabeçalho da Obra */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/obras')}
              className="flex items-center gap-1 h-8 px-2 flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Voltar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden h-8 w-8 p-0 flex-shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{obra.nome}</h1>
                <Badge variant={obra.status === 'em_andamento' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                  {obra.status?.replace('_', ' ')}
                </Badge>
              </div>
              <div className="hidden sm:flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                {obra.cliente && <span>{obra.cliente}</span>}
                {obra.cidade && <span>• {obra.cidade}/{obra.estado}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Submenu Lateral Interno (Desktop) */}
        <aside className={cn(
          "w-64 bg-white border-r border-gray-200 overflow-y-auto",
          "hidden md:block"
        )}>
          <div className="p-4 space-y-6">
            {/* Seção: Custos & Operação */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Custos & Operação da Obra
              </h2>
              <nav className="space-y-1">
                {obraSubmenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.path;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(`/obras/${obraId}/${item.path}`);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive 
                          ? "bg-blue-50 text-blue-700 font-medium" 
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Seção: Ações Rápidas */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Ações Rápidas
              </h2>
              <nav className="space-y-1">
                {acoesRapidas.map((item) => {
                  const Icon = item.icon;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(createPageUrl(item.page));
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Submenu Mobile (Dropdown) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="absolute top-0 left-0 w-64 h-full bg-white shadow-xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 mt-20 space-y-6">
                {/* Seção: Custos & Operação */}
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Custos & Operação da Obra
                  </h2>
                  <nav className="space-y-1">
                    {obraSubmenuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentSection === item.path;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(`/obras/${obraId}/${item.path}`);
                            setMobileMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive 
                              ? "bg-blue-50 text-blue-700 font-medium" 
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                              {item.badge}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Seção: Ações Rápidas */}
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Ações Rápidas
                  </h2>
                  <nav className="space-y-1">
                    {acoesRapidas.map((item) => {
                      const Icon = item.icon;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(createPageUrl(item.page));
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              {item.badge}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}