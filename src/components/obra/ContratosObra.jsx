import React, { useState } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, XCircle, FileText, ClipboardList, ShieldCheck, ShieldOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import ListaMedicoesContrato from '../medicao-contrato/ListaMedicoesContrato';

const emptyForm = {
  numero_contrato: '',
  cliente: '',
  valor_total_contrato: '',
  data_inicio: '',
  data_fim: '',
  tipo_contrato: 'privado',
  status: 'ativo',
  observacoes: '',
  garantia_ativa: false,
  data_inicio_garantia: '',
  data_fim_garantia: ''
};

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContratosObra({ obraId, obraStatus }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null); // para ver medições

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-obra', obraId],
    queryFn: () => base44.entities.ContratoObra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId
  });

  // Se um contrato está selecionado, mostra medições
  if (contratoSelecionado) {
    return (
      <ListaMedicoesContrato
        obraId={obraId}
        contrato={contratoSelecionado}
        onBack={() => setContratoSelecionado(null)}
      />
    );
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(contrato) {
    setEditing(contrato);
    setForm({
      numero_contrato: contrato.numero_contrato || '',
      cliente: contrato.cliente || '',
      valor_total_contrato: contrato.valor_total_contrato || '',
      data_inicio: contrato.data_inicio || '',
      data_fim: contrato.data_fim || '',
      tipo_contrato: contrato.tipo_contrato || 'privado',
      status: contrato.status || 'ativo',
      observacoes: contrato.observacoes || '',
      garantia_ativa: contrato.garantia_ativa || false,
      data_inicio_garantia: contrato.data_inicio_garantia || '',
      data_fim_garantia: contrato.data_fim_garantia || ''
    });
    setShowModal(true);
  }

  async function handleAtivarGarantia(contrato, obraStatus) {
    if (obraStatus !== 'concluida') {
      toast.error('A garantia só pode ser ativada após a obra ser concluída.');
      return;
    }
    if (contrato.garantia_ativa) {
      toast.info('Garantia já está ativa para este contrato.');
      return;
    }
    const hoje = new Date().toISOString().split('T')[0];
    const fimGarantia = new Date();
    fimGarantia.setFullYear(fimGarantia.getFullYear() + 5);
    const fimGarantiaStr = fimGarantia.toISOString().split('T')[0];

    await base44.entities.ContratoObra.update(contrato.id, {
      garantia_ativa: true,
      data_inicio_garantia: hoje,
      data_fim_garantia: fimGarantiaStr
    });
    queryClient.invalidateQueries(['contratos-obra', obraId]);
    toast.success(`Garantia ativada! Válida até ${new Date(fimGarantiaStr).toLocaleDateString('pt-BR')}.`);
  }

  async function handleEncerrar(contrato) {
    await base44.entities.ContratoObra.update(contrato.id, { status: 'encerrado' });
    queryClient.invalidateQueries(['contratos-obra', obraId]);
    toast.success('Contrato encerrado.');
  }

  async function handleSave() {
    if (!form.numero_contrato || !form.cliente || !form.valor_total_contrato) {
      toast.error('Preencha número, cliente e valor total.');
      return;
    }
    if (Number(form.valor_total_contrato) <= 0) {
      toast.error('Valor total deve ser maior que zero.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      obra_id: obraId,
      valor_total_contrato: Number(form.valor_total_contrato)
    };
    if (editing) {
      await base44.entities.ContratoObra.update(editing.id, payload);
      toast.success('Contrato atualizado.');
    } else {
      await base44.entities.ContratoObra.create(payload);
      toast.success('Contrato criado.');
    }
    queryClient.invalidateQueries(['contratos-obra', obraId]);
    setSaving(false);
    setShowModal(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Contratos da Obra
        </h2>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" />
          Novo Contrato
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : contratos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum contrato cadastrado para esta obra.</p>
            <Button onClick={openNew} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar primeiro contrato
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Número</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor Total</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Medido</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Início</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fim</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Garantia</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contratos.map(c => {
                    const medido = c.valor_total_medido || 0;
                    const saldo = (c.valor_total_contrato || 0) - medido;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.numero_contrato}</td>
                        <td className="px-4 py-3 text-gray-700">{c.cliente}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.valor_total_contrato)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(medido)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldo)}</td>
                        <td className="px-4 py-3 text-gray-600">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {c.tipo_contrato === 'publico' ? 'Público' : 'Privado'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${c.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {c.status === 'ativo' ? 'Ativo' : 'Encerrado'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {c.garantia_ativa ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge className="text-xs bg-blue-100 text-blue-800 gap-1 w-fit">
                                <ShieldCheck className="w-3 h-3" /> Ativa
                              </Badge>
                              {c.data_fim_garantia && (
                                <span className="text-xs text-gray-500">
                                  até {new Date(c.data_fim_garantia).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          ) : obraStatus === 'concluida' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAtivarGarantia(c, obraStatus)}
                              className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <ShieldCheck className="w-3 h-3" /> Ativar
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <ShieldOff className="w-3 h-3" /> Inativa
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setContratoSelecionado(c)}
                              title="Ver Medições"
                              className="gap-1 text-xs"
                            >
                              <ClipboardList className="w-3 h-3" />
                              Medições
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                            {c.status === 'ativo' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEncerrar(c)}
                                title="Encerrar"
                                className="text-red-500 hover:text-red-700"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Contrato */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Número do Contrato *</Label>
                <Input
                  value={form.numero_contrato}
                  onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))}
                  placeholder="Ex: CONT-001"
                />
              </div>
              <div>
                <Label>Tipo *</Label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={form.tipo_contrato}
                  onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value }))}
                >
                  <option value="privado">Privado</option>
                  <option value="publico">Público</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Cliente / Contratante *</Label>
              <Input
                value={form.cliente}
                onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>

            <div>
              <Label>Valor Total do Contrato (R$) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.valor_total_contrato}
                onChange={e => setForm(f => ({ ...f, valor_total_contrato: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}