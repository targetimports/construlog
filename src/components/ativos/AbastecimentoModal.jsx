import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import InputMoeda from '@/components/shared/InputMoeda';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Formulário de abastecimento — usado em dois lugares com a MESMA regra:
//   /Ativos            → responsável da frota lança (e já sai aprovado)
//   ObraDetalhes       → pessoal da obra lança o que abasteceu (fica PENDENTE)
// Um formulário só evita que as duas portas divirjam com o tempo.

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const hojeISO = () => new Date().toISOString().slice(0, 10);
export const ehVeiculo = (tipo) => /veiculo|carro|moto|caminh/.test(String(tipo || '').toLowerCase());

const FORM_VAZIO = {
  ativo_id: '', data: hojeISO(), medidor: '', litros: '',
  valor_litro: '', valor_total: '', combustivel: 'diesel',
  posto: '', nota_fiscal: '', observacao: '', tanque_cheio: true,
};

/**
 * @param ativoFixo  quando aberto de dentro de uma obra, o ativo já vem escolhido
 *                   (é o do empréstimo) e o seletor não aparece.
 * @param obraId     amarra a despesa àquela obra.
 */
export default function AbastecimentoModal({ open, onClose, ativoFixo = null, obraId = null, onRegistrado }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(FORM_VAZIO);

  // Carrega os ativos SEMPRE, mesmo com ativoFixo: o medidor tem de vir do cadastro
  // do ativo, que é a fonte da verdade. Antes, aberto pela obra, este modal usava o
  // medidor do EMPRÉSTIMO (leitura da saída, já desatualizada) — a tela mostrava um
  // "atual" menor que o real, deixava passar uma leitura que o servidor recusava, e o
  // usuário via o botão girar e voltar sem entender por quê.
  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500).catch(() => []),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm({ ...FORM_VAZIO, ativo_id: ativoFixo?.id || '' });
    setErrors({});
  }, [open, ativoFixo?.id]);

  // O cadastro manda; ativoFixo é só o fallback enquanto a lista não chegou.
  const ativoSel = ativos.find((a) => a.id === form.ativo_id) || ativoFixo;
  const unidade = ehVeiculo(ativoSel?.tipo) ? 'km' : 'h';
  const medidorAtual = ativoSel ? (ehVeiculo(ativoSel.tipo) ? ativoSel.km_atual : ativoSel.horimetro_atual) : null;

  // Só o que consome combustível — ferramenta e móvel não abastecem.
  const ativoOptions = useMemo(
    () => ativos
      .filter((a) => ['veiculo', 'veiculo_pequeno', 'maquina', 'equipamento'].includes(a.tipo))
      .map((a) => ({ value: a.id, label: `${a.nome || a.codigo}${a.placa ? ` — ${a.placa}` : ''}` })),
    [ativos],
  );

  const [errors, setErrors] = useState({});
  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    // valor_litro e valor_total apontam para o mesmo erro ("valor"): qualquer um limpa.
    const alvo = (campo === 'valor_litro' || campo === 'valor_total') ? 'valor' : campo;
    setErrors((e) => (e[alvo] ? { ...e, [alvo]: null } : e));
  };

  // Total ao vivo: o usuário confere com o cupom da bomba antes de salvar.
  const totalCalculado = useMemo(() => {
    const l = Number(form.litros) || 0;
    const p = Number(form.valor_litro) || 0;
    const t = Number(form.valor_total) || 0;
    if (t > 0) return t;
    return l > 0 && p > 0 ? l * p : 0;
  }, [form.litros, form.valor_litro, form.valor_total]);

  const medidorMenor = form.medidor !== '' && medidorAtual != null && Number(form.medidor) < Number(medidorAtual);

  const registrar = useMutation({
    mutationFn: (payload) => base44.functions.invoke('registrarAbastecimentoAtivo', payload),
    onSuccess: (res) => {
      const d = res.data || {};
      if (d.success === false) { toast.error(d.error || 'Erro ao registrar abastecimento.'); return; }
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['ativos'] });
      toast.success(
        d.status === 'PENDENTE'
          ? `Abastecimento de ${fmtBRL(d.valor_total)} enviado para aprovação da Matriz.`
          : `Abastecimento registrado — ${fmtBRL(d.valor_total)} em conta a pagar.`,
      );
      onRegistrado?.(d);
      onClose?.();
    },
    onError: (e) => toast.error('Erro ao registrar abastecimento: ' + (e?.message || e)),
  });

  const validar = () => {
    const e = {};
    if (!form.ativo_id) e.ativo_id = 'Selecione o veículo/máquina.';
    if (!form.data) e.data = 'Informe a data.';
    else if (form.data > hojeISO()) e.data = 'A data não pode ser futura.';
    if (!(Number(form.litros) > 0)) e.litros = 'Informe os litros abastecidos.';
    // Sem valor, a conta a pagar do posto nasceria zerada.
    if (!(totalCalculado > 0)) e.valor = 'Informe o valor por litro ou o valor total.';
    if (medidorMenor) e.medidor = 'Leitura menor que a do ativo.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    registrar.mutate({
      ativo_id: form.ativo_id,
      obra_id: obraId || undefined,
      data: form.data,
      medidor: form.medidor !== '' ? Number(form.medidor) : undefined,
      litros: Number(form.litros),
      valor_litro: form.valor_litro !== '' ? Number(form.valor_litro) : undefined,
      valor_total: form.valor_total !== '' ? Number(form.valor_total) : undefined,
      combustivel: form.combustivel,
      posto: form.posto || undefined,
      nota_fiscal: form.nota_fiscal || undefined,
      observacao: form.observacao || undefined,
      tanque_cheio: form.tanque_cheio,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Registrar Abastecimento{ativoFixo ? ` — ${ativoFixo.nome || ativoFixo.codigo}` : ''}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {ativoFixo
              ? 'O lançamento vai para aprovação do responsável pela frota.'
              : 'Gera uma conta a pagar do posto, na obra onde o ativo está operando.'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {!ativoFixo && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Veículo / máquina *</Label>
                <ComboboxBusca
                  options={ativoOptions} value={form.ativo_id}
                  onSelect={(v) => set('ativo_id', v)}
                  placeholder="Selecione o ativo" searchPlaceholder="Buscar ativo..."
                  emptyMessage="Nenhum ativo que abastece"
                  className={errors.ativo_id ? 'border-red-400' : ''}
                />
                {errors.ativo_id && <p className="text-xs text-red-500 mt-1">{errors.ativo_id}</p>}
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)}
                className={errors.data ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errors.data && <p className="text-xs text-red-500 mt-1">{errors.data}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">
                {unidade === 'km' ? 'Hodômetro' : 'Horímetro'} ({unidade})
              </Label>
              <Input
                type="number" placeholder="Leitura do painel" value={form.medidor}
                onChange={(e) => set('medidor', e.target.value)}
                className={medidorMenor ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {medidorAtual != null && !medidorMenor && (
                <p className="text-xs text-gray-400 mt-1">Atual: {fmtNum(medidorAtual, 0)} {unidade}</p>
              )}
              {medidorMenor && (
                <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Menor que a leitura atual ({fmtNum(medidorAtual, 0)} {unidade}).
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Litros *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.litros} onChange={(e) => set('litros', e.target.value)}
                className={errors.litros ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errors.litros && <p className="text-xs text-red-500 mt-1">{errors.litros}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Combustível</Label>
              <Select value={form.combustivel} onValueChange={(v) => set('combustivel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="diesel_s10">Diesel S10</SelectItem>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                  <SelectItem value="gnv">GNV</SelectItem>
                  <SelectItem value="arla">Arla 32</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Valor por litro</Label>
              <InputMoeda value={form.valor_litro} onValueChange={(v) => set('valor_litro', v)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Valor total</Label>
              <InputMoeda value={form.valor_total} onValueChange={(v) => set('valor_total', v)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Total</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-200 font-semibold text-gray-900 tabular-nums">
                {fmtBRL(totalCalculado)}
              </div>
            </div>
          </div>
          {errors.valor
            ? <p className="text-xs text-red-500 -mt-2">{errors.valor}</p>
            : <p className="text-xs text-gray-400 -mt-2">Preencha o valor por litro OU o total da bomba — o outro é calculado.</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Posto / fornecedor</Label>
              <Input placeholder="Nome do posto" value={form.posto} onChange={(e) => set('posto', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Nota fiscal / cupom</Label>
              <Input placeholder="Número do documento" value={form.nota_fiscal} onChange={(e) => set('nota_fiscal', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
            <Textarea rows={2} placeholder="Tanque completo, abastecimento parcial, quem abasteceu..."
              value={form.observacao} onChange={(e) => set('observacao', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={salvar} disabled={registrar.isPending || medidorMenor}>
            {registrar.isPending ? 'Enviando...' : ativoFixo ? 'Enviar para aprovação' : 'Registrar abastecimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
