import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit,
  FolderInput,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '../components/ui/PageHeader';

const menuPadrao = [
  { 
    name: 'Dashboard', 
    icon: 'LayoutDashboard', 
    page: 'Dashboard',
    submenu: [
      { name: 'Dashboard Geral', page: 'Dashboard' },
      { name: 'Financeiro Estratégico', page: 'FinanceiroEstrategico' },
      { name: 'IA Preditiva', page: 'IAPreditiva' },
      { name: 'Agenda', page: 'Agenda' },
      { name: 'Resumo do Sistema', page: 'ResumoSistema' }
    ]
  },
  { 
    name: 'Contatos', 
    icon: 'Users', 
    page: 'Clientes',
    submenu: [
      { name: 'Clientes', page: 'Clientes' },
      { name: 'Fornecedores', page: 'Fornecedores' },
      { name: 'Colaboradores', page: 'Colaboradores' },
      { name: 'Equipes', page: 'Equipes' }
    ]
  },
  { 
    name: 'Obras', 
    icon: 'Building2', 
    page: 'Obras',
    submenu: [
      { name: 'Todas as Obras', page: 'Obras' },
      { name: 'Gestão de Obras', page: 'GestaoObras' },
      { name: 'Orçamentos', page: 'Orcamentos' },
      { name: 'Engenharia & Qualidade', page: 'Engenharia' },
      { name: 'Diário de Obra', page: 'DiarioObra' },
      { name: 'Diário de Campo', page: 'DiarioCampo' },
      { name: 'Medições', page: 'Medicoes' },
      { name: 'Mapa de Medições', page: 'MapaMedicoes' },
      { name: 'Medição de Contratos', page: 'MedicaoContratos' },
      { name: 'Gerenciar Arquivos', page: 'GerenciarArquivos' }
    ]
  },
  { 
    name: 'Logística', 
    icon: 'Truck', 
    page: 'Frota',
    submenu: [
      { name: 'Frota', page: 'Frota' },
      { name: 'Telemetria', page: 'Telemetria' },
      { name: 'Análise Avançada', page: 'LogisticaAvancada' },
      { name: 'Viagens', page: 'Viagens' },
      { name: 'Motoristas', page: 'Motoristas' },
      { name: 'Abastecimentos', page: 'Abastecimentos' },
      { name: 'Manutenções', page: 'Manutencoes' }
    ]
  },
  { 
    name: 'Financeiro', 
    icon: 'DollarSign', 
    page: 'Financeiro',
    submenu: [
      { name: 'Visão Geral', page: 'Financeiro' },
      { name: 'BI Comercial', page: 'BIComercial' },
      { name: 'BI Compras', page: 'BICompras' },
      { name: 'BI Multiobras', page: 'BIMultiobras' }
    ]
  },
  { 
    name: 'Catálogos', 
    icon: 'FileText', 
    page: 'Insumos',
    submenu: [
      { name: 'Insumos', page: 'Insumos' },
      { name: 'Composições', page: 'Composicoes' }
    ]
  },
  { 
    name: 'Compras', 
    icon: 'ShoppingCart', 
    page: 'Compras',
    submenu: [
      { name: 'Solicitações', page: 'Solicitacoes' },
      { name: 'Ordens de Compra', page: 'Compras' },
      { name: 'Licitações', page: 'Licitacoes' },
      { name: 'Contratos', page: 'Contratos' },
      { name: 'Importar NF', page: 'ImportarNotaFiscal' },
      { name: 'Importar OrçaFascio', page: 'ImportarOrcaFacil' }
    ]
  },
  { 
    name: 'Estoque', 
    icon: 'Package', 
    page: 'Estoque',
    submenu: [
      { name: 'Visão Geral', page: 'Estoque' },
      { name: 'Depósitos', page: 'Depositos' },
      { name: 'Suprimentos Avançado', page: 'SuprimentosAvancado' }
    ]
  },
  { 
    name: 'Pessoas / RH', 
    icon: 'Users', 
    page: 'Colaboradores',
    submenu: [
      { name: 'Gestão de Mão de Obra', page: 'GestaoMaoDeObra' },
      { name: 'Colaboradores', page: 'Colaboradores' },
      { name: 'Profissionais Terceirizados', page: 'ProfissionaisTerceirizados' },
      { name: 'Equipes', page: 'Equipes' },
      { name: 'Apontamento de Horas', page: 'ApontamentoHoras' },
      { name: 'Controle de EPIs', page: 'ControleEPIs' },
      { name: 'Segurança do Trabalho', page: 'SST' }
    ]
  },
  { 
    name: 'BI & Relatórios', 
    icon: 'BarChart3', 
    page: 'BI',
    submenu: [
      { name: 'Business Intelligence', page: 'BI' },
      { name: 'Automação Orçamento', page: 'AutomacaoOrcamento' },
      { name: 'Ranking Margens Obra', page: 'RankingMargensObra' },
      { name: 'Relatórios Agendados', page: 'RelatoriosAgendados' },
      { name: 'Relatórios Gerenciais', page: 'Relatorios' },
      { name: 'Tabela SINAPI', page: 'TabelaSINAPI' }
    ]
  },
  { 
    name: 'Usuários', 
    icon: 'Users', 
    page: 'Usuarios' 
  },
  { 
    name: 'Ajustes', 
    icon: 'Settings', 
    page: 'Configuracoes',
    submenu: [
      { name: 'Expedientes por Obra', page: 'Configuracoes' },
      { name: 'Alçadas de Usuários', page: 'Governanca' },
      { name: 'Categorias', page: 'CategoriasConfig' },
      { name: 'Usuários', page: 'Usuarios' },
      { name: 'Perfis de Acesso', page: 'PerfisAcesso' },
      { name: 'Histórico de Alterações', page: 'Auditoria' },
      { name: 'Controle de Acesso Obras', page: 'ControleAcessoObras' },
      { name: 'Workflows', page: 'Workflows' },
      { name: 'Empresas', page: 'Empresas' },
      { name: 'Sistema', page: 'ConfiguracoesSistema' },
      { name: 'Configuração do Menu', page: 'ConfiguracaoMenu' }
    ]
  },
  { 
    name: 'Implementações', 
    icon: 'Lightbulb', 
    page: 'Implementacoes'
  },
  { 
    name: 'Ativos', 
    icon: 'Package', 
    page: 'Ativos',
    submenu: [
      { name: 'Ativos', page: 'Ativos' },
      { name: 'Controle de Horas', page: 'ControleHorasAtivos' },
      { name: 'Relatórios Avançados', page: 'RelatoriosAtivos' }
    ]
  },
  { 
    name: 'Apontamentos', 
    icon: 'ClipboardList', 
    page: 'ApontamentoMateriaisSemanal',
    submenu: [
      { name: 'Apontamento Semanal', page: 'ApontamentoMateriaisSemanal' },
      { name: 'Apontamentos Obrigatórios', page: 'ApontamentosObrigatorios' },
      { name: 'Configuração', page: 'ConfiguracaoApontamentos' }
    ]
  }
];

export default function ConfiguracaoMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState(null);
  const [targetGroup, setTargetGroup] = useState('');
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('Folder');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    try {
      // Tenta carregar do localStorage
      const saved = localStorage.getItem('menu_configuracao');
      if (saved) {
        const customMenu = JSON.parse(saved);
        setMenuItems(customMenu);
      } else {
        // Usa menu padrão
        const defaultMenu = menuPadrao.map(item => ({ ...item, visivel: true, id: Math.random().toString() }));
        setMenuItems(defaultMenu);
      }
    } catch (error) {
      console.error('Erro ao carregar menu:', error);
      setMenuItems(menuPadrao.map(item => ({ ...item, visivel: true, id: Math.random().toString() })));
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('menu_configuracao', JSON.stringify(menuItems));
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(menuItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setMenuItems(items);
  };

  const handleDragEndSubmenu = (parentIndex, result) => {
    if (!result.destination) return;

    const items = [...menuItems];
    const submenu = Array.from(items[parentIndex].submenu);
    const [reorderedItem] = submenu.splice(result.source.index, 1);
    submenu.splice(result.destination.index, 0, reorderedItem);
    
    items[parentIndex] = { ...items[parentIndex], submenu };
    setMenuItems(items);
  };

  const toggleVisibility = (index) => {
    const items = [...menuItems];
    items[index] = { ...items[index], visivel: !items[index].visivel };
    setMenuItems(items);
  };

  const toggleSubmenuVisibility = (parentIndex, subIndex) => {
    const items = [...menuItems];
    const submenu = [...items[parentIndex].submenu];
    submenu[subIndex] = { ...submenu[subIndex], visivel: !submenu[subIndex].visivel };
    items[parentIndex] = { ...items[parentIndex], submenu };
    setMenuItems(items);
  };

  const handleReset = () => {
    setMenuItems(menuPadrao.map(item => ({ ...item, visivel: true, id: Math.random().toString() })));
  };

  const toggleExpanded = (index) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const openMoveDialog = (parentIndex, subIndex = null) => {
    setItemToMove({ parentIndex, subIndex });
    setTargetGroup('');
    setMoveDialogOpen(true);
  };

  const handleMove = () => {
    if (!itemToMove || !targetGroup) return;

    const items = [...menuItems];
    let itemToMoveData;

    // Remover item do local atual
    if (itemToMove.subIndex !== null) {
      // É um subitem
      itemToMoveData = items[itemToMove.parentIndex].submenu[itemToMove.subIndex];
      items[itemToMove.parentIndex].submenu.splice(itemToMove.subIndex, 1);
    } else {
      // É um item principal
      itemToMoveData = items[itemToMove.parentIndex];
      items.splice(itemToMove.parentIndex, 1);
    }

    // Adicionar no novo local
    if (targetGroup === 'principal') {
      // Mover para o menu principal
      const { submenu, ...mainItem } = itemToMoveData;
      items.push(mainItem);
    } else {
      // Mover para um grupo específico
      const targetIndex = parseInt(targetGroup);
      if (!items[targetIndex].submenu) {
        items[targetIndex].submenu = [];
      }
      items[targetIndex].submenu.push(itemToMoveData);
    }

    setMenuItems(items);
    setMoveDialogOpen(false);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;

    const newGroup = {
      name: newGroupName,
      icon: newGroupIcon,
      page: newGroupName.replace(/\s+/g, ''),
      submenu: [],
      visivel: true,
      id: Math.random().toString()
    };

    setMenuItems([...menuItems, newGroup]);
    setNewGroupDialogOpen(false);
    setNewGroupName('');
    setNewGroupIcon('Folder');
  };

  return (
    <div className="space-y-6">
      {showSaveSuccess && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3 shadow-lg z-50">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Menu salvo com sucesso!</p>
            <p className="text-sm text-green-700">Recarregue a página para aplicar as alterações.</p>
          </div>
        </div>
      )}
      
      <PageHeader
        title="Configuração do Menu"
        subtitle="Organize e personalize o menu principal do sistema"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Estrutura do Menu</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setNewGroupDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Grupo
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar Padrão
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="menu-items">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {menuItems.map((item, index) => (
                      <Draggable key={item.id || index} draggableId={String(item.id || index)} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`border rounded-lg transition-all ${
                              window.location.pathname.includes(item.page)
                                ? 'bg-blue-50 border-blue-300 shadow-sm'
                                : 'bg-white'
                            }`}
                          >
                            {/* Item Principal */}
                            <div className="flex items-center gap-3 p-4">
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                              </div>
                              
                              <div className="flex-1 flex items-center gap-3">
                              <span className={`font-medium ${
                                window.location.pathname.includes(item.page)
                                  ? 'text-blue-700'
                                  : 'text-gray-900'
                              }`}>{item.name}</span>
                              {window.location.pathname.includes(item.page) && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                                  Ativo
                                </span>
                              )}
                              {item.submenu && (
                                <span className="text-sm text-gray-500">
                                  ({item.submenu.length} subitens)
                                </span>
                              )}
                              </div>

                              <div className="flex items-center gap-2">
                                {item.submenu && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpanded(index)}
                                  >
                                    {expandedItems[index] ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openMoveDialog(index)}
                                  title="Mover para outro grupo"
                                >
                                  <FolderInput className="w-4 h-4" />
                                </Button>
                                
                                <Switch
                                  checked={item.visivel !== false}
                                  onCheckedChange={() => toggleVisibility(index)}
                                />
                                
                                {item.visivel !== false ? (
                                  <Eye className="w-4 h-4 text-green-600" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {/* Submenu */}
                            {item.submenu && expandedItems[index] && (
                              <div className="border-t bg-gray-50 p-4 pl-12">
                                <DragDropContext onDragEnd={(result) => handleDragEndSubmenu(index, result)}>
                                  <Droppable droppableId={`submenu-${index}`}>
                                    {(provided) => (
                                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {item.submenu.map((subItem, subIndex) => (
                                          <Draggable
                                            key={subItem.page || subIndex}
                                            draggableId={`${index}-${subIndex}`}
                                            index={subIndex}
                                          >
                                            {(provided) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-3 p-3 rounded border transition-all ${
                                                  window.location.pathname.includes(subItem.page)
                                                    ? 'bg-blue-100 border-blue-400 shadow-sm'
                                                    : 'bg-white'
                                                }`}
                                              >
                                                <div {...provided.dragHandleProps}>
                                                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                                </div>
                                                
                                                <span className={`flex-1 text-sm ${
                                                  window.location.pathname.includes(subItem.page)
                                                    ? 'text-blue-700 font-semibold'
                                                    : 'text-gray-700'
                                                }`}>{subItem.name}</span>
                                                {window.location.pathname.includes(subItem.page) && (
                                                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                                                    Ativo
                                                  </span>
                                                )}
                                                
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openMoveDialog(index, subIndex)}
                                                    title="Mover para outro grupo"
                                                  >
                                                    <FolderInput className="w-3 h-3" />
                                                  </Button>
                                                  
                                                  <Switch
                                                    checked={subItem.visivel !== false}
                                                    onCheckedChange={() => toggleSubmenuVisibility(index, subIndex)}
                                                  />
                                                  {subItem.visivel !== false ? (
                                                    <Eye className="w-4 h-4 text-green-600" />
                                                  ) : (
                                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </Draggable>
                                        ))}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                </DragDropContext>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Como usar:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Arraste os itens para reorganizar a ordem do menu</li>
              <li>• Use o botão de olho para mostrar/ocultar itens</li>
              <li>• Use o botão de pasta para mover itens entre grupos</li>
              <li>• Expanda os grupos para organizar submenus</li>
              <li>• Clique em "Salvar Alterações" e recarregue a página para aplicar</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Novo Grupo */}
      <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo de Menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome do Grupo *</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Projetos, Marketing, Vendas..."
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Ícone</Label>
              <Select value={newGroupIcon} onValueChange={setNewGroupIcon}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Folder">Pasta</SelectItem>
                  <SelectItem value="Briefcase">Maleta</SelectItem>
                  <SelectItem value="FileText">Documento</SelectItem>
                  <SelectItem value="Settings">Configurações</SelectItem>
                  <SelectItem value="Users">Pessoas</SelectItem>
                  <SelectItem value="Building2">Prédio</SelectItem>
                  <SelectItem value="Package">Pacote</SelectItem>
                  <SelectItem value="BarChart3">Gráfico</SelectItem>
                  <SelectItem value="ShoppingCart">Carrinho</SelectItem>
                  <SelectItem value="Truck">Caminhão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                O grupo será criado vazio. Use o botão "Mover para" nos itens existentes para adicionar subitens.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewGroupDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                Criar Grupo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Mover Para */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Item para Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Item selecionado:</Label>
              <p className="text-sm font-medium text-gray-700 mt-1">
                {itemToMove && (
                  itemToMove.subIndex !== null
                    ? menuItems[itemToMove.parentIndex]?.submenu?.[itemToMove.subIndex]?.name
                    : menuItems[itemToMove.parentIndex]?.name
                )}
              </p>
            </div>

            <div>
              <Label>Mover para:</Label>
              <Select value={targetGroup} onValueChange={setTargetGroup}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o grupo de destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Menu Principal (sem grupo)</SelectItem>
                  {menuItems.map((item, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleMove} disabled={!targetGroup}>
                Mover
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}