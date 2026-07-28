import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Truck, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

// Atende a requisição transferindo material para a obra. Hierarquia Obra ← Empresa
// ← Central: origem padrão = almoxarifado da EMPRESA da obra; por item dá pra
// escolher o CENTRAL (útil quando a empresa está sem saldo).
export default function AtenderRequisicaoModal({ open, onClose, requisicao, itens = [], obraId }) {
  const qc = useQueryClient();
  const [qtds, setQtds] = useState({});
  const [origens, setOrigens] = useState({}); // itemId -> 'empresa' | 'central'
  // Veículo e motorista da entrega. OPCIONAL de propósito: muita transferência
  // acontece a pé dentro do mesmo canteiro, e exigir veículo travaria o fluxo atual.
  // Preenchidos, criam a viagem que o motorista acompanha em Entregas.
  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');

  const { data: veiculos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500).catch(() => []),
    enabled: open,
  });
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 1000).catch(() => []),
    enabled: open,
  });

  // Só veículo disponível: o que está emprestado ou em outra viagem o backend recusa
  // de qualquer forma (checagem única em viagemCore), mas melhor não oferecer.
  const veiculoOptions = useMemo(
    () => veiculos
      .filter((a) => /veiculo/.test(String(a.tipo || '')) && a.status === 'disponivel')
      .map((a) => ({ value: a.id, label: `${a.nome || a.codigo}${a.placa ? ` — ${a.placa}` : ''}` })),
    [veiculos],
  );
  // Motorista por cargo/função; se ninguém estiver marcado assim, oferece todos
  // (cadastro do cliente pode não usar o cargo "motorista").
  const motoristaOptions = useMemo(() => {
    const ativos = colaboradores.filter((c) => (c.status || 'ativo') === 'ativo');
    const mots = ativos.filter((c) => /motorista|condutor/i.test(`${c.cargo || ''} ${c.funcao || ''}`));
    return (mots.length ? mots : ativos).map((c) => ({ value: c.id, label: c.nome }));
  }, [colaboradores]);

  const obraIdReal = requisicao?.obra_id || obraId;

  // Itens da requisição — busca própria (robusto, não depende do prop `itens`).
  const { data: itensFetched = [] } = useQuery({
    queryKey: ['atender-req-itens', requisicao?.id],
    queryFn: () => base44.entities.RequisicaoObraItem.filter({ requisicao_id: requisicao.id }),
    enabled: open && !!requisicao?.id,
  });
  const itensReais = itensFetched.length ? itensFetched : (itens || []);

  // Obra -> empresa_id
  const { data: obra } = useQuery({
    queryKey: ['obra-atender', obraIdReal],
    queryFn: () => base44.entities.Obra.filter({ id: obraIdReal }).then((r) => r[0]),
    enabled: open && !!obraIdReal,
  });
  const empresaId = obra?.empresa_id;

  // Almoxarifado da empresa da obra + saldos
  const { data: locaisEmp = [] } = useQuery({
    queryKey: ['almox-emp-atender', empresaId],
    queryFn: () => base44.entities.LocalEstoque.filter({ empresa_id: empresaId }).catch(() => []),
    enabled: open && !!empresaId,
  });
  const empresaLocal = useMemo(() => locaisEmp.find((l) => (l.nivel || l.tipo) === 'EMPRESA') || null, [locaisEmp]);
  const { data: saldosEmp = [] } = useQuery({
    queryKey: ['saldos-emp-atender', empresaLocal?.id],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: empresaLocal.id }),
    enabled: open && !!empresaLocal?.id,
  });

  // Central + saldos
  const { data: locaisCentral = [] } = useQuery({
    queryKey: ['almox-central-atender'],
    queryFn: () => base44.entities.LocalEstoque.filter({ tipo: 'CENTRAL' }).catch(() => []),
    enabled: open,
  });
  const centralId = locaisCentral[0]?.id;
  const { data: saldosCentral = [] } = useQuery({
    queryKey: ['saldos-central-atender', centralId],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: centralId }),
    enabled: open && !!centralId,
  });

  const empMap = useMemo(() => { const m = {}; for (const s of saldosEmp) m[s.material_id ?? s.insumo_id] = num(s.saldo_atual); return m; }, [saldosEmp]);
  const centralMap = useMemo(() => { const m = {}; for (const s of saldosCentral) m[s.material_id ?? s.insumo_id] = num(s.saldo_atual); return m; }, [saldosCentral]);
  const temEmpresa = !!empresaLocal;

  const linhas = useMemo(() => itensReais.map((it) => {
    const iid = it.material_id ?? it.insumo_id;
    // Restante a ENVIAR = solicitado − já enviado (o enviado inclui o que está em
    // trânsito e o já recebido). Antes olhava `quantidade_atendida`, que agora só
    // conta o que a obra RECEBEU — o que deixaria reenviar o que ainda está a caminho.
    const restante = r2(num(it.quantidade_solicitada) - num(it.quantidade_enviada ?? it.quantidade_atendida));
    const saldoEmp = num(empMap[iid]);
    const saldoCent = num(centralMap[iid]);
    // origem padrão: EMPRESA quando ela tem saldo do item; senão cai pro Central.
    const origemDefault = (temEmpresa && saldoEmp > 0) ? 'empresa' : 'central';
    const origem = origens[it.id] || origemDefault;
    const saldoOrigem = origem === 'central' ? saldoCent : saldoEmp;
    const maxEnviar = r2(Math.max(0, Math.min(restante, saldoOrigem)));
    return { it, iid, restante, saldoEmp, saldoCent, origem, saldoOrigem, maxEnviar };
  }), [itensReais, empMap, centralMap, origens, temEmpresa]);

  // Pré-preenche origem (padrão fresco: empresa se tiver saldo, senão central) e a
  // quantidade sugerida, sempre que os saldos/itens (re)carregam.
  React.useEffect(() => {
    if (!open) return;
    const iniQ = {}; const iniO = {};
    for (const l of linhas) {
      const def = (temEmpresa && l.saldoEmp > 0) ? 'empresa' : 'central';
      iniO[l.it.id] = def;
      const saldoDef = def === 'central' ? l.saldoCent : l.saldoEmp;
      const maxDef = r2(Math.max(0, Math.min(l.restante, saldoDef)));
      iniQ[l.it.id] = maxDef > 0 ? String(maxDef) : '';
    }
    setOrigens(iniO);
    setQtds(iniQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, temEmpresa, saldosEmp, saldosCentral, itensReais]);

  const setOrigem = (id, novo, maxNovo) => {
    setOrigens((p) => ({ ...p, [id]: novo }));
    setQtds((p) => ({ ...p, [id]: maxNovo > 0 ? String(maxNovo) : '' }));
  };

  const excedeAlgum = linhas.some((l) => num(qtds[l.it.id]) > l.restante + 0.001 || num(qtds[l.it.id]) > l.saldoOrigem + 0.001);
  const algumValido = linhas.some((l) => num(qtds[l.it.id]) > 0);

  const atender = useMutation({
    mutationFn: async () => {
      const payloadItens = linhas
        .map((l) => ({ requisicao_item_id: l.it.id, quantidade: num(qtds[l.it.id]), origem: l.origem }))
        .filter((x) => x.quantidade > 0);
      if (payloadItens.length === 0) throw new Error('Informe ao menos uma quantidade a enviar');
      const resp = await base44.functions.invoke('atenderRequisicaoObra', { requisicao_id: requisicao.id, itens: payloadItens });

      // Viagem só depois do envio dar certo: se o estoque não saiu, não há o que levar.
      // Falha aqui não desfaz o envio — o material já está em trânsito e a viagem pode
      // ser criada depois; por isso avisa em vez de estourar erro.
      let viagem = null;
      if (veiculoId && motoristaId) {
        const rv = await base44.functions.invoke('iniciarViagemTransferencia', {
          requisicao_id: requisicao.id, veiculo_id: veiculoId, motorista_id: motoristaId,
        }).catch(() => null);
        viagem = rv?.data || null;
        if (viagem && viagem.success === false) toast.warning('Material enviado, mas a viagem não pôde ser criada: ' + viagem.error);
      }
      return { ...resp.data, viagem };
    },
    onSuccess: (data) => {
      if (data?.viagem?.success) {
        toast.success(`Material enviado — viagem ${data.viagem.numero} criada para o motorista.`);
      } else {
        toast.success('Material enviado — está em trânsito. A obra confirma o recebimento em Materiais & Estoque → Receber.');
      }
      qc.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] || '');
        return k.includes('requisic') || k.includes('req-itens') || k.includes('saldos') || k.includes('materiais-obra') || k.includes('estoque') || k.includes('saldo');
      } });
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const OrigemSelect = ({ l }) => {
    const pick = (novo) => {
      const saldo = novo === 'central' ? l.saldoCent : l.saldoEmp;
      setOrigem(l.it.id, novo, r2(Math.max(0, Math.min(l.restante, saldo))));
    };
    const Btn = ({ val, label, saldo }) => {
      const ativo = l.origem === val;
      return (
        <button
          type="button"
          onClick={() => pick(val)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${ativo ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {label} <span className={ativo ? 'text-blue-100' : 'text-gray-400'}>({r2(saldo)})</span>
        </button>
      );
    };
    return (
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden divide-x divide-gray-300">
        {temEmpresa && <Btn val="empresa" label="Empresa" saldo={l.saldoEmp} />}
        <Btn val="central" label="Central" saldo={l.saldoCent} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] sm:w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Truck className="w-5 h-5 text-blue-600" /> Atender requisição
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          Por padrão o material sai do almoxarifado da <b>empresa</b> da obra{empresaLocal ? ` (${empresaLocal.nome})` : ''}. Por item você pode trocar para o <b>Central</b> — útil quando a empresa está sem saldo.
        </p>

        {linhas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Esta requisição não tem itens.</p>
        ) : (
          <div className="mt-3">
            {/* Tabela (desktop) */}
            <div className="hidden md:block border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-500">Material</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-24">Qtd Solic.</th>
                    <th className="text-left p-2 font-semibold text-gray-500 w-56">Origem (saldo)</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-32">Enviar agora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map((l) => {
                    const v = num(qtds[l.it.id]);
                    const excede = v > l.restante + 0.001 || v > l.saldoOrigem + 0.001;
                    return (
                      <tr key={l.it.id} className={`align-middle ${excede ? 'bg-red-50' : 'bg-white'}`}>
                        <td className="p-2 min-w-[160px]">
                          <p className="font-medium text-gray-900">{l.it.material_nome || 'Material'} <span className="text-xs text-gray-400">({l.it.material_unidade})</span></p>
                          {num(l.it.quantidade_atendida) > 0 && <p className="text-xs text-gray-400">Já atendido: {r2(num(l.it.quantidade_atendida))} · Restante: {l.restante}</p>}
                        </td>
                        <td className="p-2 text-right text-gray-700 tabular-nums">{r2(num(l.it.quantidade_solicitada))}</td>
                        <td className="p-2"><OrigemSelect l={l} /></td>
                        <td className="p-1">
                          <Input type="number" min="0" max={l.maxEnviar} step="0.01"
                            value={qtds[l.it.id] ?? ''}
                            onChange={(e) => setQtds((p) => ({ ...p, [l.it.id]: e.target.value }))}
                            className={`h-10 text-sm text-right ${excede ? 'border-red-300' : ''}`}
                            placeholder={`máx ${l.maxEnviar}`}
                            disabled={l.maxEnviar <= 0} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden space-y-2">
              {linhas.map((l) => {
                const v = num(qtds[l.it.id]);
                const excede = v > l.restante + 0.001 || v > l.saldoOrigem + 0.001;
                return (
                  <div key={l.it.id} className={`border rounded-lg p-3 space-y-2 ${excede ? 'bg-red-50 border-red-200' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm min-w-0 break-words">{l.it.material_nome || 'Material'}</p>
                      <span className="text-xs text-gray-400 shrink-0">{l.it.material_unidade}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>Solicitado: <b className="text-gray-700">{r2(num(l.it.quantidade_solicitada))}</b></span>
                      {num(l.it.quantidade_atendida) > 0 && <span>Restante: <b className="text-gray-700">{l.restante}</b></span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <OrigemSelect l={l} />
                      <Input type="number" min="0" max={l.maxEnviar} step="0.01"
                        value={qtds[l.it.id] ?? ''}
                        onChange={(e) => setQtds((p) => ({ ...p, [l.it.id]: e.target.value }))}
                        className={`h-10 text-sm text-right flex-1 ${excede ? 'border-red-300' : ''}`}
                        placeholder={`máx ${l.maxEnviar}`}
                        disabled={l.maxEnviar <= 0} />
                    </div>
                    {l.maxEnviar <= 0 && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem saldo na origem escolhida.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ENTREGA: quem leva e em quê. Opcional — sem isso o material segue em
            trânsito como antes; preenchido, cria a viagem que o motorista acompanha. */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mt-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Entrega (opcional)</p>
            <p className="text-xs text-gray-500">
              Informe o veículo e o motorista para gerar a viagem. O veículo fica indisponível até a entrega terminar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Veículo</Label>
              <ComboboxBusca
                options={veiculoOptions} value={veiculoId} onSelect={setVeiculoId}
                placeholder="Sem veículo" searchPlaceholder="Buscar veículo..."
                emptyMessage="Nenhum veículo disponível"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motorista</Label>
              <ComboboxBusca
                options={motoristaOptions} value={motoristaId} onSelect={setMotoristaId}
                placeholder="Sem motorista" searchPlaceholder="Buscar motorista..."
                emptyMessage="Nenhum colaborador"
              />
            </div>
          </div>
          {(!!veiculoId !== !!motoristaId) && (
            <p className="text-xs text-amber-600 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Informe os dois (veículo e motorista) para a viagem ser criada.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={() => atender.mutate()} disabled={atender.isPending || excedeAlgum || !algumValido} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {atender.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Confirmar transferência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
