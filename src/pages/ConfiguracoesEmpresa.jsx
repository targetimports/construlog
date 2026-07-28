import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Save, Building2, DollarSign, FileCheck, Shield, Bell, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton } from '@/components/shared/Skeletons';

const MOEDA_OPCOES = [
  { value: 'BRL', label: 'Real (BRL)' },
  { value: 'USD', label: 'Dólar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' }
];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const CFG_PADRAO = {
  moeda_padrao: 'BRL',
  requer_aprovacao_medicoes: true,
  requer_aprovacao_compras: true,
  requer_auditoria: true,
  ativar_workflows: false,
  limite_aprovacao_automatica: 0,
  dias_prazo_pagamento_padrao: 30,
  percentual_retencao_iss: 5,
  percentual_retencao_inss: 11,
  enviar_notificacoes_email: true,
  enviar_notificacoes_sms: false
};

export default function ConfiguracoesEmpresa() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('geral');

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });
  const { data: empresas = [], isLoading } = useQuery({ queryKey: ['empresas'], queryFn: () => base44.entities.Empresa.list() });
  // Identidade visual (nome/logo/favicon/carrossel) é lida da MATRIZ por useBranding e
  // pelo endpoint público do carrossel — então editamos o MESMO registro (matriz), com
  // fallback para a primeira empresa. Evita "salvei mas não mudou".
  const empresa = empresas.find((e) => e.tipo === 'matriz') || empresas[0];

  const [formData, setFormData] = useState({
    nome: '', cnpj: '', razao_social: '', endereco: '', telefone: '', email: '', whatsapp: '',
    nome_sistema: '', logo_url: '', favicon_url: '', carrossel: [],
    configuracoes: { ...CFG_PADRAO }
  });
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState({ logo: false, favicon: false });
  const [uploadingCarrossel, setUploadingCarrossel] = useState(false);

  useEffect(() => {
    if (empresa) {
      setFormData({
        nome: empresa.nome || '', cnpj: empresa.cnpj || '', razao_social: empresa.razao_social || '',
        endereco: empresa.endereco || '', telefone: empresa.telefone || '', email: empresa.email || '', whatsapp: empresa.whatsapp || '',
        nome_sistema: empresa.nome_sistema || '', logo_url: empresa.logo_url || '', favicon_url: empresa.favicon_url || '',
        carrossel: Array.isArray(empresa.carrossel) ? empresa.carrossel : [],
        configuracoes: { ...CFG_PADRAO, ...(empresa.configuracoes || {}) }
      });
    }
  }, [empresa]);

  const handleUpload = async (campo, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [campo]: true }));
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.url;
      if (url) { setField(campo === 'logo' ? 'logo_url' : 'favicon_url', url); toast.success('Arquivo enviado!'); }
      else toast.error('O upload não retornou uma URL.');
    } catch (e) {
      toast.error('Erro no upload: ' + e.message);
    } finally {
      setUploading((u) => ({ ...u, [campo]: false }));
    }
  };

  const setField = (key, value) => {
    setFormData((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: null } : e));
  };
  const setCfg = (key, value) => {
    setFormData((f) => ({ ...f, configuracoes: { ...f.configuracoes, [key]: value } }));
    setErrors((e) => (e[key] ? { ...e, [key]: null } : e));
  };

  // Carrossel da landing (máx. 5 imagens).
  const addImagemCarrossel = async (file) => {
    if (!file) return;
    if ((formData.carrossel || []).length >= 5) { toast.error('Limite de 5 imagens.'); return; }
    setUploadingCarrossel(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.url;
      if (url) {
        setFormData((f) => ({ ...f, carrossel: [...(f.carrossel || []), { url, titulo: '', texto: '' }] }));
        toast.success('Imagem adicionada! Clique em Salvar para aplicar.');
      } else toast.error('O upload não retornou uma URL.');
    } catch (e) {
      toast.error('Erro no upload: ' + e.message);
    } finally {
      setUploadingCarrossel(false);
    }
  };
  const setSlide = (i, key, value) => setFormData((f) => {
    const arr = [...(f.carrossel || [])];
    arr[i] = { ...arr[i], [key]: value };
    return { ...f, carrossel: arr };
  });
  const removeSlide = (i) => setFormData((f) => ({ ...f, carrossel: (f.carrossel || []).filter((_, idx) => idx !== i) }));

  const updateMutation = useMutation({
    mutationFn: (data) => (empresa ? base44.entities.Empresa.update(empresa.id, data) : base44.entities.Empresa.create(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empresas'] }); toast.success('Configurações salvas com sucesso!'); },
    onError: (error) => toast.error('Erro ao salvar configurações: ' + error.message)
  });

  // Em qual aba cada campo mora — o erro é inútil se estiver numa aba escondida.
  const ABA_DO_CAMPO = {
    nome: 'geral', cnpj: 'geral', email: 'geral', telefone: 'geral', whatsapp: 'geral',
    dias_prazo_pagamento_padrao: 'financeiro', percentual_retencao_iss: 'financeiro',
    percentual_retencao_inss: 'financeiro', limite_aprovacao_automatica: 'aprovacoes',
  };

  const validar = () => {
    const e = {};
    const c = formData.configuracoes;
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');

    // Nome alimenta o branding (sidebar, login, PDFs): vazio deixa o sistema sem identidade.
    if (!formData.nome?.trim()) e.nome = 'Informe o nome fantasia.';

    const cnpj = soDigitos(formData.cnpj);
    if (cnpj && cnpj.length !== 14) e.cnpj = 'CNPJ deve ter 14 dígitos.';

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'E-mail inválido.';

    const tel = soDigitos(formData.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto.';

    // WhatsApp entra em link wa.me: precisa do DDI+DDD+número para funcionar.
    const zap = soDigitos(formData.whatsapp);
    if (zap && (zap.length < 12 || zap.length > 13)) e.whatsapp = 'Use DDI+DDD+número (ex.: 5511999999999).';

    const percentual = (campo, rotulo) => {
      const v = Number(c[campo]);
      if (c[campo] !== '' && (isNaN(v) || v < 0 || v > 100)) e[campo] = `${rotulo} deve ficar entre 0 e 100.`;
    };
    percentual('percentual_retencao_iss', 'Retenção ISS');
    percentual('percentual_retencao_inss', 'Retenção INSS');

    if (c.dias_prazo_pagamento_padrao !== '' && Number(c.dias_prazo_pagamento_padrao) < 0) {
      e.dias_prazo_pagamento_padrao = 'Prazo não pode ser negativo.';
    }
    if (c.limite_aprovacao_automatica !== '' && Number(c.limite_aprovacao_automatica) < 0) {
      e.limite_aprovacao_automatica = 'Limite não pode ser negativo.';
    }

    setErrors(e);
    const campos = Object.keys(e);
    if (campos.length) {
      const aba = ABA_DO_CAMPO[campos[0]];
      if (aba && aba !== activeTab) setActiveTab(aba); // leva o usuário até o erro
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    const c = formData.configuracoes;
    updateMutation.mutate({
      ...formData,
      configuracoes: {
        ...c,
        limite_aprovacao_automatica: num(c.limite_aprovacao_automatica),
        dias_prazo_pagamento_padrao: num(c.dias_prazo_pagamento_padrao),
        percentual_retencao_iss: num(c.percentual_retencao_iss),
        percentual_retencao_inss: num(c.percentual_retencao_inss)
      }
    });
  };

  const isAdmin = ['admin', 'programador'].includes(String(user?.role || '').toLowerCase()) || user?.isOwner === true;

  if (user && !isAdmin) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-6"><p className="text-center text-gray-600">Acesso restrito a administradores.</p></CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <FormSkeleton fields={6} />;
  }

  const cfg = formData.configuracoes;

  return (
    <div className="space-y-6 pb-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações da Empresa</h1>
          <p className="text-gray-500 mt-1">Dados, financeiro, aprovações, segurança e notificações da empresa</p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="geral" className="gap-2"><Building2 className="w-4 h-4" /> Geral</TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2"><DollarSign className="w-4 h-4" /> Financeiro</TabsTrigger>
          <TabsTrigger value="aprovacoes" className="gap-2"><FileCheck className="w-4 h-4" /> Aprovações</TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2"><Shield className="w-4 h-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral" className="mt-6 space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Identidade Visual</CardTitle>
              <CardDescription>Nome, logo e ícone que aparecem no sistema e na aba do navegador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="w-full">
                <Label className="mb-1.5 block">Nome do Sistema</Label>
                <Input className="h-11 w-full" value={formData.nome_sistema} onChange={(e) => setField('nome_sistema', e.target.value)} placeholder="Ex: Germanos Construlog" />
                <p className="text-xs text-gray-500 mt-1">Exibido na sidebar, no título da aba e na tela de login.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UploadCampo titulo="Logo do Sistema" descricao="PNG/SVG/WebP (fundo transparente). Aparece na sidebar e no login." url={formData.logo_url} loading={uploading.logo} onFile={(f) => handleUpload('logo', f)} onClear={() => setField('logo_url', '')} quadrado={false} />
                <UploadCampo titulo="Ícone da Aba (favicon)" descricao="Imagem quadrada (ex.: 512×512). Aparece na aba do navegador." url={formData.favicon_url} loading={uploading.favicon} onFile={(f) => handleUpload('favicon', f)} onClear={() => setField('favicon_url', '')} quadrado />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-blue-600" /> Carrossel da Landing</CardTitle>
              <CardDescription>Imagens que rodam no carrossel da página inicial pública. Até 5 imagens (título e subtítulo opcionais).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(formData.carrossel || []).length === 0 && (
                <p className="text-sm text-gray-500">Nenhuma imagem cadastrada. Sem imagens, o carrossel usa os placeholders padrão.</p>
              )}
              {(formData.carrossel || []).map((s, i) => (
                <div key={i} className="flex gap-3 items-start border border-gray-100 rounded-lg p-3">
                  <img src={s.url} alt="" className="w-28 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0 bg-gray-50" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Input className="h-9" placeholder="Título (opcional)" value={s.titulo || ''} onChange={(e) => setSlide(i, 'titulo', e.target.value)} />
                    <Input className="h-9" placeholder="Subtítulo (opcional)" value={s.texto || ''} onChange={(e) => setSlide(i, 'texto', e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSlide(i)} className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {(formData.carrossel || []).length < 5 ? (
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg px-4 py-2 transition-colors w-fit">
                  <Upload className="w-4 h-4" />
                  {uploadingCarrossel ? 'Enviando…' : 'Adicionar imagem'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingCarrossel}
                    onChange={(e) => { addImagemCarrossel(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              ) : (
                <p className="text-xs text-gray-500">Limite de 5 imagens atingido. Remova alguma para adicionar outra.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Informações da Empresa</CardTitle>
              <CardDescription>Dados básicos da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Nome Fantasia *</Label>
                  <Input className={`h-11 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.nome} onChange={(e) => setField('nome', e.target.value)} />
                  {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block">CNPJ</Label>
                  <Input mask="cnpj" className={`h-11 ${errors.cnpj ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.cnpj} onChange={(e) => setField('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                  {errors.cnpj && <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>}
                </div>
              </div>
              <div><Label className="mb-1.5 block">Razão Social</Label><Input className="h-11" value={formData.razao_social} onChange={(e) => setField('razao_social', e.target.value)} /></div>
              <div><Label className="mb-1.5 block">Endereço</Label><Input className="h-11" value={formData.endereco} onChange={(e) => setField('endereco', e.target.value)} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Telefone</Label>
                  <Input mask="telefone" className={`h-11 ${errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="(00) 00000-0000" value={formData.telefone} onChange={(e) => setField('telefone', e.target.value)} />
                  {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block">E-mail</Label>
                  <Input className={`h-11 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="email" value={formData.email} onChange={(e) => setField('email', e.target.value)} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">WhatsApp (botão da landing page)</Label>
                {/* Guardamos só os dígitos com DDI: o link wa.me não aceita máscara.
                    Ex.: 5571988887777 = Brasil (55) + DDD (71) + número. */}
                <Input
                  className={`h-11 ${errors.whatsapp ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  inputMode="numeric"
                  placeholder="5571988887777"
                  value={formData.whatsapp}
                  onChange={(e) => setField('whatsapp', e.target.value.replace(/\D/g, ''))}
                />
                {errors.whatsapp
                  ? <p className="text-xs text-red-500 mt-1.5">{errors.whatsapp}</p>
                  : <p className="text-xs text-gray-500 mt-1.5">
                      Só números, com o 55 na frente: código do país (55) + DDD + número. É o contato do botão “Fale conosco” da página inicial.
                    </p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financeiro */}
        <TabsContent value="financeiro" className="mt-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Configurações Financeiras</CardTitle>
              <CardDescription>Parâmetros financeiros e tributários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="md:w-1/2">
                <Label className="mb-1.5 block">Moeda Padrão</Label>
                <ComboboxBusca options={MOEDA_OPCOES} value={cfg.moeda_padrao} onSelect={(v) => setCfg('moeda_padrao', v)} placeholder="Selecione a moeda" searchPlaceholder="Buscar..." />
              </div>
              <div className="md:w-1/2">
                <Label className="mb-1.5 block">Prazo de Pagamento Padrão (dias)</Label>
                <Input className={`h-11 ${errors.dias_prazo_pagamento_padrao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" min="0" value={cfg.dias_prazo_pagamento_padrao} onChange={(e) => setCfg('dias_prazo_pagamento_padrao', e.target.value)} />
                {errors.dias_prazo_pagamento_padrao && <p className="text-xs text-red-500 mt-1">{errors.dias_prazo_pagamento_padrao}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Retenção ISS (%)</Label>
                  <Input className={`h-11 ${errors.percentual_retencao_iss ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" max="100" value={cfg.percentual_retencao_iss} onChange={(e) => setCfg('percentual_retencao_iss', e.target.value)} />
                  {errors.percentual_retencao_iss && <p className="text-xs text-red-500 mt-1">{errors.percentual_retencao_iss}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block">Retenção INSS (%)</Label>
                  <Input className={`h-11 ${errors.percentual_retencao_inss ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" max="100" value={cfg.percentual_retencao_inss} onChange={(e) => setCfg('percentual_retencao_inss', e.target.value)} />
                  {errors.percentual_retencao_inss && <p className="text-xs text-red-500 mt-1">{errors.percentual_retencao_inss}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aprovações */}
        <TabsContent value="aprovacoes" className="mt-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Fluxos de Aprovação</CardTitle>
              <CardDescription>Configure os processos de aprovação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleLinha titulo="Requer Aprovação para Medições" descricao="Medições precisam ser aprovadas antes de gerar contas" checked={cfg.requer_aprovacao_medicoes} onChange={(c) => setCfg('requer_aprovacao_medicoes', c)} />
              <ToggleLinha titulo="Requer Aprovação para Compras" descricao="Requisições de compra precisam ser aprovadas" checked={cfg.requer_aprovacao_compras} onChange={(c) => setCfg('requer_aprovacao_compras', c)} />
              <ToggleLinha titulo="Ativar Workflows Avançados" descricao="Habilita workflows customizados e multi-nível" checked={cfg.ativar_workflows} onChange={(c) => setCfg('ativar_workflows', c)} />
              <div className="md:w-1/2">
                <Label className="mb-1.5 block">Limite para Aprovação Automática (R$)</Label>
                <Input className={`h-11 ${errors.limite_aprovacao_automatica ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={cfg.limite_aprovacao_automatica} onChange={(e) => setCfg('limite_aprovacao_automatica', e.target.value)} />
                {errors.limite_aprovacao_automatica && <p className="text-xs text-red-500 mt-1">{errors.limite_aprovacao_automatica}</p>}
                <p className="text-sm text-gray-500 mt-1">Valores abaixo deste limite são aprovados automaticamente.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="mt-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Segurança e Auditoria</CardTitle>
              <CardDescription>Configure políticas de segurança</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleLinha titulo="Ativar Auditoria Completa" descricao="Registra todas as ações dos usuários no sistema" checked={cfg.requer_auditoria} onChange={(c) => setCfg('requer_auditoria', c)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="mt-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Notificações</CardTitle>
              <CardDescription>Configure como os usuários receberão notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleLinha titulo="Enviar Notificações por E-mail" descricao="Usuários recebem alertas importantes por e-mail" checked={cfg.enviar_notificacoes_email} onChange={(c) => setCfg('enviar_notificacoes_email', c)} />
              <ToggleLinha titulo="Enviar Notificações por SMS" descricao="Alertas críticos são enviados via SMS" checked={cfg.enviar_notificacoes_sms} onChange={(c) => setCfg('enviar_notificacoes_sms', c)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleLinha({ titulo, descricao, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Label className="text-gray-900">{titulo}</Label>
        <p className="text-sm text-gray-500">{descricao}</p>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function UploadCampo({ titulo, descricao, url, loading, onFile, onClear, quadrado }) {
  const inputId = `upload-${titulo.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <Label className="mb-1.5 block">{titulo}</Label>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 ${quadrado ? 'w-14 h-14' : 'w-28 h-14'}`}>
          {url ? <img src={url} alt={titulo} className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input id={inputId} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <label htmlFor={inputId} className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer w-fit">
            <Upload className="w-3.5 h-3.5" /> {loading ? 'Enviando...' : (url ? 'Trocar' : 'Enviar')}
          </label>
          {url && <button type="button" onClick={onClear} className="text-xs text-red-600 hover:underline text-left">Remover</button>}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1.5">{descricao}</p>
    </div>
  );
}
