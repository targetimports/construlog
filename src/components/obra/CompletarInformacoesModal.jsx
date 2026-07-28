import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Lightbulb, Copy, Lock } from 'lucide-react';
import { calcularCompletude, inferirDatasDosCronogramas } from './obraCompletude';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

const isMongoId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim());

function resolveClienteNome(obra, clientesFetched = []) {
  if (obra.cliente_id) {
    const found = clientesFetched.find(c => c.id === obra.cliente_id);
    if (found) return found.nome || found.razao_social || found.nome_fantasia || '';
  }
  const candidates = [obra.cliente_nome, obra.contratante_nome, obra.contratante];
  for (const c of candidates) {
    if (c && !isMongoId(c)) return c;
  }
  // campo legado
  if (typeof obra.cliente === 'string' && !isMongoId(obra.cliente)) return obra.cliente;
  return '';
}

export default function CompletarInformacoesModal({ obra, open, onClose, onSaved, readOnly = false }) {
  const queryClient = useQueryClient();
  const didInitRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const { data: cronogramaItems = [] } = useQuery({
    queryKey: ['cronograma-items', obra?.id],
    queryFn: () => base44.entities.CronogramaItem.filter({ obra_id: obra?.id }),
    enabled: !!obra?.id && open,
  });

  const { data: marcos = [] } = useQuery({
    queryKey: ['marcos-obra', obra?.id],
    queryFn: () => base44.entities.MarcoObra.filter({ obra_id: obra?.id }),
    enabled: !!obra?.id && open,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: open,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-lista'],
    queryFn: () => base44.entities.User.list(),
    enabled: open,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list(),
    enabled: open,
  });

  // Mesma regra do ObraForm: os responsáveis vêm de usuários + colaboradores,
  // filtrados por papel; TI/Admin/Programador nunca entram. Sem isso, este modal
  // era um furo — permitia atribuir qualquer um (inclusive TI) como responsável.
  const opcoesResponsavel = useMemo(() => {
    const normalizeRole = (s) => {
      const v = String(s || '').toLowerCase();
      if (v.includes('mestre')) return 'mestre_obras';
      if (v.includes('financ')) return 'financeiro';
      if (v.includes('administrativ')) return 'administrativo';
      if (v.includes('engenh')) return 'engenheiro';
      if (v.includes('compra')) return 'compras';
      if (v.includes('encarregad')) return 'encarregado';
      if (v.includes('rh') || v.includes('pessoal')) return 'rh';
      if (v === 'admin' || v.includes('administrador') || v === 'programador' || v === 'ti') return 'admin';
      return v;
    };
    const pessoas = [
      ...usuarios.map((u) => ({ nome: u.full_name || u.email, roles: [normalizeRole(u.role), normalizeRole(u.cargo)].filter(Boolean) })),
      ...colaboradores.map((c) => ({ nome: c.nome || c.full_name, roles: [normalizeRole(c.cargo)] })),
    ].filter((p) => p.nome);
    return (aceitos) => {
      const vistos = new Set();
      return pessoas.filter((p) => {
        if (p.roles.includes('admin')) return false;              // TI/Admin fora
        if (!p.roles.some((r) => aceitos.includes(r))) return false;
        if (vistos.has(p.nome)) return false;                     // sem duplicar nome
        vistos.add(p.nome);
        return true;
      });
    };
  }, [usuarios, colaboradores]);

  // Inicializar form ao abrir — aguarda clientes carregarem para resolver nome
  useEffect(() => {
    if (!open) { didInitRef.current = false; return; }
    if (!obra?.id) return;
    // Re-inicializar sempre que clientes carregarem (podem chegar depois)
    // mas só forçar reset quando o modal for aberto pela primeira vez (didInitRef)
    // ou quando os clientes chegarem e ainda não tiver cliente_nome resolvido
    const nomeCliente = resolveClienteNome(obra, clientes);
    const sugestao = inferirDatasDosCronogramas(cronogramaItems, marcos);

    setForm(prev => {
      // Se já inicializado e cliente_nome já está resolvido, não sobrescrever edições do usuário
      if (didInitRef.current && prev.cliente_nome) return prev;
      return {
        nome: obra.nome || '',
        cliente_id: obra.cliente_id || '',
        cliente_nome: nomeCliente,
        responsavel_tecnico: obra.responsavel_tecnico || '',
        responsavel_obra: obra.responsavel_obra || '',
        data_inicio: obra.data_inicio || sugestao?.data_inicio || '',
        data_prevista_fim: obra.data_prevista_fim || sugestao?.data_prevista_fim || '',
        endereco: obra.endereco || '',
        cidade: obra.cidade || '',
        estado: obra.estado || '',
        cep: obra.cep || '',
        area_total: obra.area_total || '',
        tipo_obra: obra.tipo_obra || '',
        tipo_intervencao: obra.tipo_intervencao || '',
        categoria_dre: obra.categoria_dre || '',
        centro_custo_codigo: obra.centro_custo_codigo || '',
        centro_custo_nome: obra.centro_custo_nome || '',
      };
    });
    didInitRef.current = true;
  }, [open, obra?.id, clientes.length, usuarios.length]);

  const sugestaoDatas = inferirDatasDosCronogramas(cronogramaItems, marcos);
  const temSugestao = sugestaoDatas && (
    (!form.data_inicio && sugestaoDatas.data_inicio) ||
    (!form.data_prevista_fim && sugestaoDatas.data_prevista_fim)
  );

  // completude dinâmica baseada nos dados atuais da obra + o que já foi salvo
  const obraComForm = { ...obra, ...form };
  const completude = calcularCompletude(obraComForm);

  const handleSave = async () => {
    if (!obra?.id || readOnly) return;
    // Datas incoerentes não passam (mesmo sendo um checklist progressivo).
    if (form.data_inicio && form.data_prevista_fim && form.data_prevista_fim < form.data_inicio) {
      toast.error('O término não pode ser anterior ao início.');
      return;
    }
    setSaving(true);
    try {
      // Montar payload com exatamente os campos que o schema de completude valida
      const payload = {};
      if (form.nome) payload.nome = form.nome;
      // cliente_id — campo oficial de completude
      if (form.cliente_id) {
        payload.cliente_id = form.cliente_id;
        // NÃO sobrescrever campo "cliente" com ID bruto; manter nome legado se houver
      }
      if (form.cliente_nome) payload.cliente_nome = form.cliente_nome;
      // responsavel_tecnico e responsavel_obra — exatamente esses nomes de campo
      payload.responsavel_tecnico = form.responsavel_tecnico || '';
      payload.responsavel_obra = form.responsavel_obra || '';
      if (form.data_inicio) payload.data_inicio = form.data_inicio;
      if (form.data_prevista_fim) payload.data_prevista_fim = form.data_prevista_fim;
      payload.endereco = form.endereco || '';
      payload.cidade = form.cidade || '';
      payload.estado = form.estado || '';
      if (form.cep) payload.cep = form.cep;
      if (form.area_total) payload.area_total = Number(form.area_total);
      if (form.tipo_obra) payload.tipo_obra = form.tipo_obra;
      if (form.tipo_intervencao) payload.tipo_intervencao = form.tipo_intervencao;
      if (form.categoria_dre) payload.categoria_dre = form.categoria_dre;
      if (form.centro_custo_codigo) payload.centro_custo_codigo = form.centro_custo_codigo;
      if (form.centro_custo_nome) payload.centro_custo_nome = form.centro_custo_nome;

      await base44.entities.Obra.update(obra.id, payload);

      // Forçar refetch direto do backend — sem usar cache antigo
      await queryClient.invalidateQueries({ queryKey: ['obra', obra.id] });
      await queryClient.invalidateQueries({ queryKey: ['obras-list'] });
      // Refetch imediato para garantir dados frescos antes de fechar
      await queryClient.refetchQueries({ queryKey: ['obra', obra.id], exact: true });

      toast.success('Informações salvas com sucesso!');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!obra) return null;

  const clienteNomeExibicao = resolveClienteNome(obra, clientes);
  const copyId = (id) => { navigator.clipboard.writeText(id); toast.success('ID copiado!'); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {readOnly && <Lock className="w-4 h-4 text-gray-400" />}
            Checklist de Completude da Obra
          </DialogTitle>
          <p className="text-sm text-gray-500">{obra.nome}</p>
        </DialogHeader>

        {/* Dados já cadastrados */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Dados já cadastrados</p>
          <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-blue-700">
            {clienteNomeExibicao && (
              <div className="flex items-center gap-1">
                <span>Cliente: <strong>{clienteNomeExibicao}</strong></span>
                {obra.cliente_id && (
                  <button onClick={() => copyId(obra.cliente_id)} className="text-blue-400 hover:text-blue-600" title="Copiar ID">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            {obra.responsavel_tecnico && <div>Resp. Técnico: <strong>{obra.responsavel_tecnico}</strong></div>}
            {obra.responsavel_obra && <div>Resp. Obra: <strong>{obra.responsavel_obra}</strong></div>}
            {obra.data_inicio && <div>Início: <strong>{new Date(obra.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>}
            {obra.data_prevista_fim && <div>Término: <strong>{new Date(obra.data_prevista_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>}
            {obra.cidade && <div>Local: <strong>{obra.cidade}{obra.estado ? `/${obra.estado}` : ''}</strong></div>}
          </div>
          {!clienteNomeExibicao && !obra.responsavel_tecnico && !obra.data_inicio && (
            <p className="text-xs text-blue-500 mt-1">Nenhum dado essencial cadastrado ainda.</p>
          )}
        </div>

        {/* Progresso */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Completude do Cadastro</span>
            <span className={`text-sm font-bold ${completude.percent >= 80 ? 'text-green-600' : completude.percent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {completude.percent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${completude.percent >= 80 ? 'bg-green-500' : completude.percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${completude.percent}%` }}
            />
          </div>

          {completude.missingEssential.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-red-700 mb-1">Essenciais pendentes:</p>
              <div className="flex flex-wrap gap-1">
                {completude.missingEssential.map(p => (
                  <Badge key={p.key} className="bg-red-100 text-red-700 border-red-200 text-xs">{p.label}</Badge>
                ))}
              </div>
            </div>
          )}
          {completude.missingRecommended.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Recomendados:</p>
              <div className="flex flex-wrap gap-1">
                {completude.missingRecommended.map(p => (
                  <Badge key={p.key} className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{p.label}</Badge>
                ))}
              </div>
            </div>
          )}
          {completude.completa && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Todos os campos essenciais preenchidos!</span>
            </div>
          )}
        </div>

        {/* Sugestão datas do cronograma */}
        {temSugestao && !readOnly && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-blue-700">
              <strong>Sugestão do cronograma:</strong>{' '}
              {sugestaoDatas.data_inicio && `Início: ${new Date(sugestaoDatas.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}`}
              {sugestaoDatas.data_inicio && sugestaoDatas.data_prevista_fim && ' · '}
              {sugestaoDatas.data_prevista_fim && `Término: ${new Date(sugestaoDatas.data_prevista_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`}
            </div>
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 h-7 text-xs"
              onClick={() => setForm(prev => ({
                ...prev,
                data_inicio: !prev.data_inicio ? (sugestaoDatas.data_inicio || prev.data_inicio) : prev.data_inicio,
                data_prevista_fim: !prev.data_prevista_fim ? (sugestaoDatas.data_prevista_fim || prev.data_prevista_fim) : prev.data_prevista_fim,
              }))}>
              Aplicar
            </Button>
          </div>
        )}

        {readOnly && (
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 flex items-center gap-2 text-sm text-gray-600">
            <Lock className="w-4 h-4" />
            Você não tem permissão para editar esta obra. Visualização somente leitura.
          </div>
        )}

        {/* Formulário */}
        <div className="space-y-4">
          <div>
            <Label>Nome da Obra</Label>
            <Input
              value={form.nome || ''}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome da obra"
              disabled={readOnly}
            />
          </div>

          {/* Cliente */}
          <div>
            <Label>
              Cliente / Contratante
              {completude.missingEssential.some(p => p.key === 'cliente_id') && (
                <span className="ml-1 text-red-500 text-xs">Obrigatório</span>
              )}
            </Label>
            {clientes.length > 0 ? (
              <ComboboxBusca
                value={form.cliente_id || ''}
                options={clientes.map(c => ({ value: c.id, label: c.nome || c.razao_social || c.nome_fantasia || 'Sem nome' }))}
                onSelect={(v) => {
                  const c = clientes.find(x => x.id === v);
                  if (c) setForm({ ...form, cliente_id: c.id, cliente_nome: c.nome || c.razao_social || c.nome_fantasia || '' });
                }}
                placeholder={form.cliente_nome || 'Selecionar cliente'}
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Nenhum cliente encontrado."
                disabled={readOnly}
              />
            ) : (
              <Input
                value={form.cliente_nome || ''}
                onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                placeholder="Nome do cliente"
                disabled={readOnly}
              />
            )}
            {form.cliente_nome && (
              <div className="mt-1 text-xs flex items-center gap-1 text-green-700">
                <CheckCircle2 className="w-3 h-3" />
                <strong>{form.cliente_nome}</strong>
                {form.cliente_id && (
                  <button onClick={() => copyId(form.cliente_id)} className="text-gray-400 hover:text-gray-600 ml-1">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            {!form.cliente_nome && !form.cliente_id && (
              <p className="mt-1 text-xs text-gray-400 italic">Falta informação</p>
            )}
          </div>

          {/* Responsável Técnico */}
          <div>
            <Label>
              Responsável Técnico
              {completude.missingEssential.some(p => p.key === 'responsavel_tecnico') && (
                <span className="ml-1 text-red-500 text-xs">Obrigatório</span>
              )}
            </Label>
            <ComboboxBusca
              value={form.responsavel_tecnico || ''}
              options={opcoesResponsavel(['engenheiro']).map(p => ({ value: p.nome, label: p.nome }))}
              onSelect={(v) => setForm({ ...form, responsavel_tecnico: v })}
              placeholder="Selecionar engenheiro"
              searchPlaceholder="Buscar engenheiro..."
              emptyMessage="Nenhum engenheiro encontrado."
              disabled={readOnly}
            />
            {form.responsavel_tecnico && (
              <div className="mt-1 text-xs flex items-center gap-1 text-green-700">
                <CheckCircle2 className="w-3 h-3" />
                <strong>{form.responsavel_tecnico}</strong>
              </div>
            )}
            {!form.responsavel_tecnico && (
              <p className="mt-1 text-xs text-gray-400 italic">Falta informação</p>
            )}
          </div>

          {/* Responsável da Obra */}
          <div>
            <Label>
              Responsável da Obra
              {completude.missingEssential.some(p => p.key === 'responsavel_obra') && (
                <span className="ml-1 text-red-500 text-xs">Obrigatório</span>
              )}
            </Label>
            <ComboboxBusca
              value={form.responsavel_obra || ''}
              options={opcoesResponsavel(['mestre_obras', 'encarregado']).map(p => ({ value: p.nome, label: p.nome }))}
              onSelect={(v) => setForm({ ...form, responsavel_obra: v })}
              placeholder="Selecionar mestre de obras"
              searchPlaceholder="Buscar mestre / encarregado..."
              emptyMessage="Nenhum mestre de obras encontrado."
              disabled={readOnly}
            />
            {form.responsavel_obra && (
              <div className="mt-1 text-xs flex items-center gap-1 text-green-700">
                <CheckCircle2 className="w-3 h-3" />
                <strong>{form.responsavel_obra}</strong>
              </div>
            )}
            {!form.responsavel_obra && (
              <p className="mt-1 text-xs text-gray-400 italic">Falta informação</p>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Data de Início
                {completude.missingEssential.some(p => p.key === 'data_inicio') && (
                  <span className="ml-1 text-red-500 text-xs">Obrigatório</span>
                )}
              </Label>
              <Input type="date" value={form.data_inicio || ''} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} disabled={readOnly} />
            </div>
            <div>
              <Label>
                Data de Término Previsto
                {completude.missingEssential.some(p => p.key === 'data_prevista_fim') && (
                  <span className="ml-1 text-red-500 text-xs">Obrigatório</span>
                )}
              </Label>
              <Input type="date" value={form.data_prevista_fim || ''} onChange={(e) => setForm({ ...form, data_prevista_fim: e.target.value })} disabled={readOnly} />
              {form.data_inicio && form.data_prevista_fim && form.data_prevista_fim < form.data_inicio && (
                <p className="text-xs text-red-600 mt-1">O término não pode ser anterior ao início.</p>
              )}
            </div>
          </div>

          {/* Localização */}
          <div>
            <Label>Endereço</Label>
            <Input value={form.endereco || ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, avenida, número..." disabled={readOnly} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={form.cidade || ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex: Salvador" disabled={readOnly} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado || ''} onValueChange={(v) => setForm({ ...form, estado: v })} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>CEP</Label>
            <Input mask="cep" value={form.cep || ''} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" disabled={readOnly} />
          </div>

          {/* Tipo e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Obra</Label>
              <Select value={form.tipo_obra || ''} onValueChange={(v) => setForm({ ...form, tipo_obra: v })} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="edificacao">Edificação</SelectItem>
                  <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                  <SelectItem value="reforma">Reforma</SelectItem>
                  <SelectItem value="obra_farm">Obra Farm</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria DRE</Label>
              <Select value={form.categoria_dre || ''} onValueChange={(v) => setForm({ ...form, categoria_dre: v })} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDUCACAO">Educação</SelectItem>
                  <SelectItem value="SAUDE">Saúde</SelectItem>
                  <SelectItem value="INFRA">Infraestrutura</SelectItem>
                  <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Nome Centro de Custo <span className="text-gray-400 text-xs">(recomendado)</span></Label>
            <Input value={form.centro_custo_nome || ''} onChange={(e) => setForm({ ...form, centro_custo_nome: e.target.value })} placeholder="Ex: CC-Salvador-Educacao-Edificacao" disabled={readOnly} />
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-4 border-t">
          {!readOnly ? (
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} className={readOnly ? 'flex-1' : ''}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}