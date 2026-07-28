import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useHasPermission } from '@/components/shared/RBACContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Lock, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import RemuneracaoEncargosEmpresa from '@/components/rh/RemuneracaoEncargosEmpresa';
import RemuneracaoDescontosFuncionario from '@/components/rh/RemuneracaoDescontosFuncionario';
import RemuneracaoResumoMensal from '@/components/rh/RemuneracaoResumoMensal';
import JornadaTrabalho from '@/components/rh/JornadaTrabalho';
import BeneficiosCustosExtras from '@/components/rh/BeneficiosCustosExtras';
import BeneficiosManager from '@/components/rh/BeneficiosManager';
import { useEmpresaAtiva } from '@/components/shared/useEmpresaAtiva';
import { ROLES } from '@/components/shared/roles';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_VALUES = new Set(ROLES.map((r) => r.value));

const departamentoOptions = [
  { value: 'engenharia', label: 'Engenharia' },
  { value: 'producao', label: 'Produção' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'logistica', label: 'Logística' },
  { value: 'compras', label: 'Compras' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'rh', label: 'RH' }
];

const cargoPadraoOptions = [
  'Mestre de Obras',
  'Engenheiro',
  'Arquiteto',
  'Encarregado',
  'Pedreiro',
  'Servente',
  'Eletricista',
  'Encanador',
  'Pintor',
  'Carpinteiro',
  'Armador',
  'Operador de Máquinas',
  'Motorista',
  'Almoxarife',
  'Administrativo',
  'Financeiro'
];

export default function FormIntegrado({ formData, setFormData, onSubmit, isLoading }) {
  const [selectedObras, setSelectedObras] = useState(formData.obras_vinculadas || []);
  const [selectedEquipes, setSelectedEquipes] = useState(formData.equipes_vinculadas || []);
  const [novoCargo, setNovoCargo] = useState('');
  const [mostraCargos, setMostraCargos] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
  });

  // Permissões granulares
  const canViewSalario = useHasPermission('RH_SALARIO_VIEW');
  const canEditSalario = useHasPermission('RH_SALARIO_EDIT');
  const canViewColaborador = useHasPermission('RH_COLABORADOR_VIEW');
  const canEditColaborador = useHasPermission('RH_COLABORADOR_EDIT');
  
  // Fallback: verificar role básico
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity
  });
  
  const canEditRemuneracao = canEditSalario || (currentUser && ['admin', 'admin_empresa', 'rh'].includes(currentUser.role || currentUser.perfil_acesso));

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 100)
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list()
  });

  // Merge cargos padrão com cargos existentes + o cargo atual do formulário
  // (garante que um cargo recém-criado apareça selecionado no Select).
  const cargosExistentes = [...new Set(colaboradores.map(c => c.cargo).filter(Boolean))];
  const cargosUnicos = [...new Set([...cargoPadraoOptions, ...cargosExistentes, formData.cargo].filter(Boolean))].sort();

  const handleAddObra = (obraId) => {
    if (!obraId) return;
    
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;

    const newObra = {
      obra_id: obraId,
      funcao_na_obra: '',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: null,
      status: 'ativo'
    };

    setSelectedObras([...selectedObras, newObra]);
    setFormData({
      ...formData,
      obras_vinculadas: [...selectedObras, newObra],
      obra_atual: obraId
    });
  };

  const handleRemoveObra = (index) => {
    const newObras = selectedObras.filter((_, i) => i !== index);
    setSelectedObras(newObras);
    setFormData({
      ...formData,
      obras_vinculadas: newObras,
      obra_atual: newObras.length > 0 ? newObras[0].obra_id : ''
    });
  };

  const handleUpdateObra = (index, field, value) => {
    const newObras = [...selectedObras];
    newObras[index][field] = value;
    setSelectedObras(newObras);
    setFormData({
      ...formData,
      obras_vinculadas: newObras
    });
  };

  const handleToggleEquipe = (equipeId) => {
    let newEquipes;
    if (selectedEquipes.includes(equipeId)) {
      newEquipes = selectedEquipes.filter(id => id !== equipeId);
    } else {
      newEquipes = [...selectedEquipes, equipeId];
    }
    setSelectedEquipes(newEquipes);
    setFormData({
      ...formData,
      equipes_vinculadas: newEquipes
    });
  };

  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setFormData({ ...formData, [k]: v });
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };
  const soDigitos = (v) => String(v || '').replace(/\D/g, '');

  const validar = () => {
    const e = {};
    if (!formData.nome?.trim()) e.nome = 'Informe o nome completo';

    const cpf = soDigitos(formData.cpf);
    if (!cpf) e.cpf = 'CPF é obrigatório';
    else if (cpf.length !== 11) e.cpf = 'CPF deve ter 11 dígitos';

    if (!formData.cargo?.trim()) e.cargo = 'Selecione o cargo';

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'E-mail inválido';

    const tel = soDigitos(formData.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto';

    if (formData.data_admissao && formData.data_admissao > new Date().toISOString().split('T')[0]) {
      e.data_admissao = 'A admissão não pode ser futura';
    }

    // Diarista sem valor da diária gera conta a pagar zerada na aprovação do ponto.
    if (formData.tipo_pagamento === 'DIARIA' && !(Number(formData.valor_diaria) > 0)) {
      e.valor_diaria = 'Informe o valor da diária';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitValidado = (ev) => {
    if (!validar()) {
      ev.preventDefault();
      toast.error('Verifique os campos destacados.');
      return;
    }
    onSubmit(ev);
  };

  return (
    <form onSubmit={handleSubmitValidado} className="space-y-6">
      {/* Dados Pessoais */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Informações Pessoais</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nome Completo *</Label>
            <Input
              value={formData.nome}
              onChange={(e) => set('nome', e.target.value)}
              className={`mt-1.5 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
          </div>
          <div>
            <Label>CPF *</Label>
            <Input
              mask="cpf"
              value={formData.cpf}
              onChange={(e) => set('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className={`mt-1.5 ${errors.cpf ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
          </div>
          <div>
            <Label>Cargo *</Label>
            <div className="relative mt-1.5">
              <Select value={formData.cargo} onValueChange={(v) => {
                if (v === '__novo__') {
                  setMostraCargos(true);
                } else {
                  set('cargo', v);
                  setMostraCargos(false);
                }
              }}>
                <SelectTrigger className={errors.cargo ? 'border-red-400 focus:ring-red-400' : ''}>
                  <SelectValue placeholder="Selecionar cargo ou criar novo" />
                </SelectTrigger>
                <SelectContent>
                  {cargosUnicos.map(cargo => (
                    <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                  ))}
                  <SelectItem value="__novo__">+ Criar novo cargo</SelectItem>
                </SelectContent>
              </Select>
              {mostraCargos && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value)}
                    placeholder="Nome do novo cargo"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (novoCargo.trim()) {
                        set('cargo', novoCargo);
                        setNovoCargo('');
                        setMostraCargos(false);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {errors.cargo && <p className="text-xs text-red-500 mt-1">{errors.cargo}</p>}
            </div>
          </div>
          <div>
            <Label>Departamento</Label>
            <Select value={formData.departamento} onValueChange={(v) => setFormData({ ...formData, departamento: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departamentoOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa</Label>
            <div className="mt-1.5">
              <ComboboxBusca
                options={[{ value: '__none', label: '— Nenhuma —' }, ...empresas.filter((e) => e.nome || e.nome_fantasia || e.razao_social).map((e) => ({ value: e.id, label: e.nome || e.nome_fantasia || e.razao_social }))]}
                value={formData.empresa_id || '__none'}
                onSelect={(v) => setFormData({ ...formData, empresa_id: v === '__none' ? '' : v })}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de Admissão</Label>
            <Input
              type="date"
              value={formData.data_admissao}
              onChange={(e) => set('data_admissao', e.target.value)}
              className={`mt-1.5 ${errors.data_admissao ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.data_admissao && <p className="text-xs text-red-500 mt-1">{errors.data_admissao}</p>}
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              mask="telefone"
              value={formData.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              className={`mt-1.5 ${errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
          </div>
          <div>
            <Label>E-mail Pessoal</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => set('email', e.target.value)}
              className={`mt-1.5 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label>Tipo de Pagamento *</Label>
            <Select value={formData.tipo_pagamento || 'SALARIO_FIXO'} onValueChange={(v) => { setFormData({ ...formData, tipo_pagamento: v, valor_diaria: v === 'SALARIO_FIXO' ? 0 : formData.valor_diaria }); setErrors((p) => ({ ...p, valor_diaria: null })); }}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALARIO_FIXO">Salário Fixo</SelectItem>
                <SelectItem value="DIARIA">Diária</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{formData.tipo_pagamento === 'DIARIA' ? 'Valor da Diária (R$) *' : 'Salário (R$)'}</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.tipo_pagamento === 'DIARIA' ? formData.valor_diaria : formData.salario}
              onChange={(e) => set(formData.tipo_pagamento === 'DIARIA' ? 'valor_diaria' : 'salario', e.target.value)}
              className={`mt-1.5 ${errors.valor_diaria ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              placeholder="0,00"
            />
            {errors.valor_diaria
              ? <p className="text-xs text-red-500 mt-1">{errors.valor_diaria}</p>
              : formData.tipo_pagamento === 'DIARIA' && (
                <p className="text-xs text-gray-500 mt-1">Valor da diária para cálculo de presença</p>
              )}
          </div>
          <div className="col-span-2">
            <Label>Endereço</Label>
            <Input
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Acesso ao Sistema — login = e-mail do colaborador, criado automaticamente */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-600" /> Acesso ao Sistema</h3>
        {EMAIL_RE.test((formData.email || '').trim()) ? (
          <>
            <p className="text-sm text-gray-600">O acesso é criado automaticamente usando o <strong>e-mail pessoal</strong> acima como login. Senha inicial = <strong>CPF</strong> (só dígitos) — recomende trocar no primeiro acesso.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Login (e-mail)</Label>
                <Input value={formData.email} disabled className="mt-1.5 bg-gray-50" />
              </div>
              <div>
                <Label>Perfil de acesso</Label>
                <Select value={ROLE_VALUES.has(formData.user_role) ? formData.user_role : 'operacional'} onValueChange={(v) => setFormData({ ...formData, user_role: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Informe um <strong>e-mail pessoal</strong> acima para que o colaborador tenha acesso ao sistema. Sem e-mail, ele fica cadastrado mas <strong>sem login</strong> (você pode adicionar o e-mail depois e gerar o acesso na lista de colaboradores).</span>
          </div>
        )}
      </div>

      {/* REMUNERAÇÃO E CUSTOS + JORNADA - TABS */}
      <Tabs defaultValue="dados" className="w-full border-t pt-4">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-4">
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="beneficios">Benefícios/Extras</TabsTrigger>
        </TabsList>

        {/* ABA: DADOS PESSOAIS (já existe acima) - vazio aqui, apenas estrutura */}
        <TabsContent value="dados" className="hidden">
        </TabsContent>

        {/* ABA: REMUNERAÇÃO E CUSTOS */}
         <TabsContent value="remuneracao" className="space-y-6 mt-6">
           {!canViewSalario && (
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
               <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
               <p>Sem permissão para visualizar remuneração. Apenas RH e Admin podem acessar.</p>
             </div>
           )}

           {canViewSalario && !canEditRemuneracao && (
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm text-blue-800">
               <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" />
               <p>Modo visualização. Você não pode editar remuneração.</p>
             </div>
           )}

          {!canViewSalario && (
            <div className="text-center py-8 text-gray-500">
              Você não tem permissão para visualizar esta seção.
            </div>
          )}

          {canViewSalario && (
          <div className="space-y-6">
            {/* Seção: Base de Salário */}
            <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900">Salário Base e Bonificação</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Salário Base Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.remuneracao?.salario_base_mensal || ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        remuneracao: {
                          ...(formData.remuneracao || {}),
                          salario_base_mensal: isNaN(valor) ? 0 : Math.max(0, valor)
                        }
                      });
                    }}
                    disabled={!canEditRemuneracao}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Bonificação Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.remuneracao?.bonificacao_mensal || ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        remuneracao: {
                          ...(formData.remuneracao || {}),
                          bonificacao_mensal: isNaN(valor) ? 0 : Math.max(0, valor)
                        }
                      });
                    }}
                    disabled={!canEditRemuneracao}
                    className="text-sm"
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            {/* Encargos da Empresa */}
            <RemuneracaoEncargosEmpresa
              formData={formData}
              setFormData={setFormData}
              canEdit={canEditRemuneracao}
              paramsRH={{}}
            />

            {/* Descontos do Funcionário */}
            <RemuneracaoDescontosFuncionario
              formData={formData}
              setFormData={setFormData}
              canEdit={canEditRemuneracao}
              paramsRH={{}}
            />

            {/* Resumo Mensal */}
            <RemuneracaoResumoMensal formData={formData} paramsRH={{}} />
            </div>
            )}
            </TabsContent>

            {/* ABA: JORNADA DE TRABALHO */}
        <TabsContent value="jornada" className="space-y-6 mt-6">
          {!canEditRemuneracao && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2 text-sm text-yellow-800">
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Você não tem permissão para editar jornada. Apenas RH e Admin podem.</p>
            </div>
          )}

          <JornadaTrabalho
            formData={formData}
            setFormData={setFormData}
            canEdit={canEditRemuneracao}
          />
        </TabsContent>

        {/* ABA: BENEFÍCIOS E CUSTOS EXTRAS */}
        <TabsContent value="beneficios" className="space-y-6 mt-6">
          {!canEditRemuneracao && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2 text-sm text-yellow-800">
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Você não tem permissão para editar benefícios. Apenas RH e Admin podem.</p>
            </div>
          )}

          {formData.id && (
            <BeneficiosManager
              colaborador_id={formData.id}
              canEdit={canEditRemuneracao}
            />
          )}

          {!formData.id && (
            <div className="text-center py-8 text-gray-500">
              <p>Salve o colaborador primeiro para gerenciar benefícios.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Equipes Vinculadas */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Equipes (opcional)</h3>
          <span className="text-xs text-gray-500">O colaborador pode trabalhar sem equipe</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {equipes.length > 0 ? (
            equipes.map(equipe => (
              <label key={equipe.id} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer">
                <Checkbox
                  checked={selectedEquipes.includes(equipe.id)}
                  onCheckedChange={() => handleToggleEquipe(equipe.id)}
                />
                <div>
                  <p className="font-medium text-sm text-gray-900">{equipe.nome}</p>
                  {equipe.lider && <p className="text-xs text-gray-600">Líder: {equipe.lider}</p>}
                </div>
              </label>
            ))
          ) : (
            <p className="text-sm text-gray-600 col-span-2">Nenhuma equipe cadastrada. Colaboradores podem trabalhar sem equipe.</p>
          )}
        </div>
      </div>

      {/* Obras Vinculadas */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Obras Vinculadas</h3>
            <p className="text-xs text-gray-500 mt-1">Vincule o colaborador às obras onde ele atuará</p>
          </div>
          <div className="w-56">
            <ComboboxBusca
              options={obras.filter((obra) => !selectedObras.some((o) => o.obra_id === obra.id)).map((obra) => ({ value: obra.id, label: obra.nome }))}
              value=""
              onSelect={handleAddObra}
              placeholder="+ Adicionar obra"
              searchPlaceholder="Buscar obra..."
            />
          </div>
        </div>

        {selectedObras.length > 0 ? (
          <div className="space-y-3">
            {selectedObras.map((obra, index) => {
              const obraInfo = obras.find(o => o.id === obra.obra_id);
              return (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{obraInfo?.nome}</p>
                      <p className="text-sm text-gray-600">{obraInfo?.codigo}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveObra(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Função na Obra</Label>
                      <Input
                        value={obra.funcao_na_obra || ''}
                        onChange={(e) => handleUpdateObra(index, 'funcao_na_obra', e.target.value)}
                        placeholder="Ex: Mestre, Encarregado, Pedreiro..."
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={obra.status} onValueChange={(v) => handleUpdateObra(index, 'status', v)}>
                        <SelectTrigger className="mt-1 text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="pausado">Pausado</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Data Início</Label>
                      <Input
                        type="date"
                        value={obra.data_inicio}
                        onChange={(e) => handleUpdateObra(index, 'data_inicio', e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data Fim (opcional)</Label>
                      <Input
                        type="date"
                        value={obra.data_fim || ''}
                        onChange={(e) => handleUpdateObra(index, 'data_fim', e.target.value || null)}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600 text-center py-4">Nenhuma obra vinculada</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : 'Salvar Colaborador'}
        </Button>
      </div>
    </form>
  );
}