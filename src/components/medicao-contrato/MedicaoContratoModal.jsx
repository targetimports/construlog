import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Upload, X, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

function calcular(bruto, percRetencao, percImposto) {
  const b = Number(bruto) || 0;
  const r = Math.max(0, b * ((Number(percRetencao) || 0) / 100));
  const i = Math.max(0, b * ((Number(percImposto) || 0) / 100));
  const l = Math.max(0, b - r - i);
  return { valorRetencao: r, valorImposto: i, valorLiquido: l };
}

const EMPTY = {
  numero_medicao: '',
  data_medicao: '',
  valor_bruto: '',
  percentual_retencao_aplicado: 0,
  percentual_imposto_aplicado: 0,
  observacao: '',
  valor_real_oficial: '',
  valor_real_fonte: '',
  valor_real_motivo: ''
};

const LIMITE_DIVERGENCIA_PCT = 5; // % acima do qual exibe alerta

export default function MedicaoContratoModal({ open, onClose, obraId, contrato, editing, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [calc, setCalc] = useState({ valorRetencao: 0, valorImposto: 0, valorLiquido: 0 });
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // Anexos
  const [boletimFile, setBoletimFile] = useState(null);
  const [nfFile, setNfFile] = useState(null);
  const [uploadingBoletim, setUploadingBoletim] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [boletimUrl, setBoletimUrl] = useState('');
  const [boletimNome, setBoletimNome] = useState('');
  const [nfUrl, setNfUrl] = useState('');
  const [nfNome, setNfNome] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        numero_medicao: editing.numero_medicao || '',
        data_medicao: editing.data_medicao || '',
        valor_bruto: editing.valor_bruto || '',
        percentual_retencao_aplicado: editing.percentual_retencao_aplicado ?? 0,
        percentual_imposto_aplicado: editing.percentual_imposto_aplicado ?? 0,
        observacao: editing.observacao || '',
        valor_real_oficial: editing.valor_real_oficial ?? '',
        valor_real_fonte: editing.valor_real_fonte || '',
        valor_real_motivo: editing.valor_real_motivo || ''
      });
      setBoletimUrl(editing.anexo_boletim_url || '');
      setBoletimNome(editing.anexo_boletim_nome || '');
      setNfUrl(editing.anexo_nota_fiscal_url || '');
      setNfNome(editing.anexo_nota_fiscal_nome || '');
    } else {
      setForm({ ...EMPTY, data_medicao: new Date().toISOString().split('T')[0] });
      setBoletimUrl(''); setBoletimNome('');
      setNfUrl(''); setNfNome('');
      setBoletimFile(null); setNfFile(null);
    }
  }, [editing, open]);

  // Recalcular ao mudar valores
  useEffect(() => {
    setCalc(calcular(form.valor_bruto, form.percentual_retencao_aplicado, form.percentual_imposto_aplicado));
  }, [form.valor_bruto, form.percentual_retencao_aplicado, form.percentual_imposto_aplicado]);

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function uploadAnexo(file, tipo) {
    if (!file) return null;
    if (tipo === 'boletim') setUploadingBoletim(true);
    else setUploadingNF(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (tipo === 'boletim') {
      setBoletimUrl(file_url);
      setBoletimNome(file.name);
      setUploadingBoletim(false);
    } else {
      setNfUrl(file_url);
      setNfNome(file.name);
      setUploadingNF(false);
    }
    return file_url;
  }

  async function handleSave() {
    if (!form.data_medicao || !form.valor_bruto) {
      toast.error('Preencha data e valor bruto.');
      return;
    }
    if (Number(form.valor_bruto) <= 0) {
      toast.error('Valor bruto deve ser maior que zero.');
      return;
    }
    setSaving(true);

    // Upload pendentes
    let bUrl = boletimUrl, bNome = boletimNome;
    let nUrl = nfUrl, nNome = nfNome;
    if (boletimFile && !boletimUrl) {
      bUrl = await uploadAnexo(boletimFile, 'boletim');
      bNome = boletimFile.name;
    }
    if (nfFile && !nfUrl) {
      nUrl = await uploadAnexo(nfFile, 'nf');
      nNome = nfFile.name;
    }

    const { valorRetencao, valorImposto, valorLiquido } = calcular(
      form.valor_bruto, form.percentual_retencao_aplicado, form.percentual_imposto_aplicado
    );

    // Detectar se valor_real_oficial mudou (para auditoria)
    const valorRealOficial = form.valor_real_oficial !== '' ? Number(form.valor_real_oficial) : undefined;
    const valorRealMudou = valorRealOficial !== undefined &&
      (!editing || editing.valor_real_oficial !== valorRealOficial);

    const payload = {
      obra_id: obraId,
      contrato_id: contrato.id,
      numero_medicao: form.numero_medicao ? Number(form.numero_medicao) : undefined,
      data_medicao: form.data_medicao,
      valor_bruto: Number(form.valor_bruto),
      percentual_retencao_aplicado: Number(form.percentual_retencao_aplicado) || 0,
      valor_retencao: valorRetencao,
      percentual_imposto_aplicado: Number(form.percentual_imposto_aplicado) || 0,
      valor_imposto: valorImposto,
      valor_liquido_calculado: valorLiquido,
      observacao: form.observacao,
      anexo_boletim_url: bUrl || undefined,
      anexo_boletim_nome: bNome || undefined,
      anexo_nota_fiscal_url: nUrl || undefined,
      anexo_nota_fiscal_nome: nNome || undefined,
      ...(valorRealOficial !== undefined && {
        valor_real_oficial: valorRealOficial,
        valor_real_fonte: form.valor_real_fonte || undefined,
        valor_real_motivo: form.valor_real_motivo || undefined,
        ...(valorRealMudou && {
          valor_real_alterado_por: user?.email,
          valor_real_alterado_em: new Date().toISOString()
        })
      })
    };

    if (editing) {
      await base44.entities.MedicaoContrato.update(editing.id, payload);
      toast.success('Medição atualizada.');
    } else {
      await base44.entities.MedicaoContrato.create({ ...payload, status: 'rascunho' });
      toast.success('Medição criada.');
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Medição' : 'Nova Medição'}</DialogTitle>
          {contrato && (
            <p className="text-xs text-gray-500 mt-1">Contrato: {contrato.numero_contrato} — {contrato.cliente}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Número e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nº da Medição</Label>
              <Input
                type="number"
                min="1"
                placeholder="Auto"
                value={form.numero_medicao}
                onChange={e => setField('numero_medicao', e.target.value)}
              />
            </div>
            <div>
              <Label>Data da Medição *</Label>
              <Input
                type="date"
                value={form.data_medicao}
                onChange={e => setField('data_medicao', e.target.value)}
              />
            </div>
          </div>

          {/* Valor Bruto */}
          <div>
            <Label>Valor Bruto (R$) *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.valor_bruto}
              onChange={e => setField('valor_bruto', e.target.value)}
            />
          </div>

          {/* Retenção e Imposto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>% Retenção</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentual_retencao_aplicado}
                onChange={e => setField('percentual_retencao_aplicado', e.target.value)}
              />
            </div>
            <div>
              <Label>% Impostos</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentual_imposto_aplicado}
                onChange={e => setField('percentual_imposto_aplicado', e.target.value)}
              />
            </div>
          </div>

          {/* Resumo calculado */}
          {Number(form.valor_bruto) > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor Bruto</span>
                <span className="font-semibold text-gray-900">{fmt(form.valor_bruto)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) Retenção ({form.percentual_retencao_aplicado}%)</span>
                <span>{fmt(calc.valorRetencao)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>(-) Impostos ({form.percentual_imposto_aplicado}%)</span>
                <span>{fmt(calc.valorImposto)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-blue-800">
                <span>Valor Líquido</span>
                <span>{fmt(calc.valorLiquido)}</span>
              </div>
            </div>
          )}

          {/* Boletim de Medição */}
          <div>
            <Label>Boletim de Medição (PDF)</Label>
            {boletimUrl ? (
              <div className="flex items-center gap-2 mt-1 p-2 border rounded bg-green-50">
                <FileText className="w-4 h-4 text-green-600" />
                <a href={boletimUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 truncate flex-1 hover:underline">
                  {boletimNome || 'Arquivo anexado'}
                </a>
                <button onClick={() => { setBoletimUrl(''); setBoletimNome(''); setBoletimFile(null); }}>
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-500">
                  <Upload className="w-4 h-4" />
                  {uploadingBoletim ? 'Enviando...' : 'Clique para anexar PDF'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={uploadingBoletim}
                    onChange={async e => {
                      const f = e.target.files[0];
                      if (f) { setBoletimFile(f); await uploadAnexo(f, 'boletim'); }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Nota Fiscal */}
          <div>
            <Label>Nota Fiscal (PDF / XML)</Label>
            {nfUrl ? (
              <div className="flex items-center gap-2 mt-1 p-2 border rounded bg-green-50">
                <FileText className="w-4 h-4 text-green-600" />
                <a href={nfUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 truncate flex-1 hover:underline">
                  {nfNome || 'Arquivo anexado'}
                </a>
                <button onClick={() => { setNfUrl(''); setNfNome(''); setNfFile(null); }}>
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-500">
                  <Upload className="w-4 h-4" />
                  {uploadingNF ? 'Enviando...' : 'Clique para anexar PDF ou XML'}
                  <input
                    type="file"
                    accept=".pdf,.xml"
                    className="hidden"
                    disabled={uploadingNF}
                    onChange={async e => {
                      const f = e.target.files[0];
                      if (f) { setNfFile(f); await uploadAnexo(f, 'nf'); }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Valor Real/Oficial (Tgov etc.) */}
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Valor Real / Oficial (BM)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor Oficial (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: vindo do Tgov"
                  value={form.valor_real_oficial}
                  onChange={e => setField('valor_real_oficial', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Fonte</Label>
                <Input
                  placeholder="Ex: Tgov, SIGA, Contratante"
                  value={form.valor_real_fonte}
                  onChange={e => setField('valor_real_fonte', e.target.value)}
                />
              </div>
            </div>
            {/* Painel de divergência */}
            {form.valor_real_oficial !== '' && Number(form.valor_bruto) > 0 && (() => {
              const calculado = Number(form.valor_bruto);
              const oficial = Number(form.valor_real_oficial);
              const diff = oficial - calculado;
              const pct = calculado > 0 ? Math.abs(diff / calculado * 100) : 0;
              const acima = pct > LIMITE_DIVERGENCIA_PCT;
              return (
                <div className={`rounded-md p-3 text-xs space-y-1 ${acima ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor Calculado (itens)</span>
                    <span className="font-semibold">{fmt(calculado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor Oficial ({form.valor_real_fonte || 'externo'})</span>
                    <span className="font-semibold">{fmt(oficial)}</span>
                  </div>
                  <div className={`flex justify-between border-t pt-1 font-bold ${acima ? 'text-red-700' : 'text-green-700'}`}>
                    <span>Divergência</span>
                    <span>{diff >= 0 ? '+' : ''}{fmt(diff)} ({pct.toFixed(2)}%)</span>
                  </div>
                  {acima && (
                    <div className="flex items-start gap-1 mt-1 text-red-700">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Divergência acima de {LIMITE_DIVERGENCIA_PCT}% — informe o motivo abaixo.</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div>
              <Label className="text-xs">Motivo da divergência / observação sobre o valor oficial</Label>
              <Input
                placeholder="Explique a diferença, se houver"
                value={form.valor_real_motivo}
                onChange={e => setField('valor_real_motivo', e.target.value)}
              />
            </div>
            {editing?.valor_real_alterado_por && (
              <p className="text-xs text-gray-500">
                Último registro do valor oficial por <strong>{editing.valor_real_alterado_por}</strong> em{' '}
                {new Date(editing.valor_real_alterado_em).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {/* Observação */}
          <div>
            <Label>Observações</Label>
            <Input
              placeholder="Opcional"
              value={form.observacao}
              onChange={e => setField('observacao', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Medição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}