import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Tag, AlertTriangle, CheckCircle2, Clock, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import InputMoeda from '@/components/shared/InputMoeda';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton, KpiCardsSkeleton } from '@/components/shared/Skeletons';

// CUSTO POR SERVIÇO — a fila de classificação da obra.
//
// O sistema sabe quanto a obra gastou e, desde a linha-base do contrato, quanto
// cada serviço deveria custar. Esta tela liga as duas pontas: diz a que serviço
// pertence cada despesa. Sem isso o desvio existe no total e em lugar nenhum.
//
// Por que uma FILA e não um campo no lançamento: quem paga a nota no financeiro
// raramente sabe se o cimento foi para a fundação ou para o contrapiso. Quem
// sabe é a obra, depois. Classificar no ato seria classificar errado — ou não
// classificar.

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

const CATEGORIAS = {
  material: 'Material',
  mao_de_obra: 'Mão de obra',
  equipamento: 'Equipamento',
  combustivel: 'Combustível',
  indireto: 'Indiretos',
};
const catLabel = (c) => CATEGORIAS[c] || c || '—';

const dataBR = (iso) => {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};

// ── Cartão de indicador ───────────────────────────────────────────────────
function Kpi({ rotulo, valor, sub, cor = 'text-gray-900', fundo = 'bg-white border-gray-200' }) {
  return (
    <Card className={fundo}>
      <CardContent className="p-3 sm:p-4">
        <p className="text-gray-500 text-xs sm:text-sm mb-1">{rotulo}</p>
        <p className={`text-lg sm:text-xl font-bold truncate ${cor}`}>{valor}</p>
        {sub && <p className="text-gray-400 text-[11px] mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Diálogo de rateio ─────────────────────────────────────────────────────
// Uma despesa pode ser dividida entre vários serviços: a nota de material da
// semana raramente pertence a um só. O que sobrar fica sem apontar — e continua
// aparecendo na fila, em vez de sumir.
function DialogoRateio({ despesa, servicos, onFechar, onSalvar, salvando }) {
  const [linhas, setLinhas] = useState(() => [{ contrato_item_id: '', valor: despesa?.valor_nao_apontado || 0 }]);

  const opcoes = useMemo(
    () => servicos.map((s) => ({
      value: s.contrato_item_id,
      label: `${s.codigo ? `${s.codigo} · ` : ''}${s.descricao}`.slice(0, 90),
    })),
    [servicos],
  );

  const somaLinhas = r2(linhas.reduce((s, l) => s + num(l.valor), 0));
  const restante = r2(num(despesa?.valor) - somaLinhas);
  const excedeu = somaLinhas > num(despesa?.valor) + 0.011;
  const semServico = linhas.some((l) => !l.contrato_item_id && num(l.valor) > 0);
  const duplicado = new Set(linhas.map((l) => l.contrato_item_id).filter(Boolean)).size
    !== linhas.filter((l) => l.contrato_item_id).length;

  const atualizar = (i, campo, valor) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const podeSalvar = !excedeu && !semServico && !duplicado && !salvando
    && linhas.some((l) => l.contrato_item_id && num(l.valor) > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Apontar a que serviço pertence</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-900">{despesa.descricao}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
            <span>{catLabel(despesa.categoria)}</span>
            <span>{dataBR(despesa.data)}</span>
            <span className="font-semibold text-gray-700">{fmt(despesa.valor)}</span>
            {!despesa.realizado && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                comprometido — ainda não pago
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {linhas.map((l, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-1 min-w-0">
                <ComboboxBusca
                  options={opcoes}
                  value={l.contrato_item_id}
                  onSelect={(v) => atualizar(i, 'contrato_item_id', v)}
                  placeholder="Escolher o serviço..."
                  searchPlaceholder="Buscar serviço do contrato..."
                  emptyMessage="Nenhum serviço encontrado."
                  buscarParaListar={opcoes.length > 60}
                />
              </div>
              <div className="w-full sm:w-40 shrink-0">
                <InputMoeda value={l.valor} onValueChange={(v) => atualizar(i, 'valor', v)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-600 shrink-0"
                onClick={() => setLinhas((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)))}
                disabled={linhas.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((ls) => [...ls, { contrato_item_id: '', valor: Math.max(0, restante) }])}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Dividir com outro serviço
          </Button>
        </div>

        <div className="border-t border-gray-200 pt-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Apontado</span>
            <span className="font-semibold tabular-nums">{fmt(somaLinhas)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fica sem apontar</span>
            <span className={`font-semibold tabular-nums ${restante > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {fmt(Math.max(0, restante))}
            </span>
          </div>
          {excedeu && (
            <p className="text-red-600 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> A soma passa o valor da despesa.
            </p>
          )}
          {duplicado && <p className="text-red-600 text-xs">O mesmo serviço aparece em duas linhas — some numa só.</p>}
          {semServico && <p className="text-red-600 text-xs">Há valor sem serviço escolhido.</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button
            onClick={() => onSalvar(linhas.filter((l) => l.contrato_item_id && num(l.valor) > 0))}
            disabled={!podeSalvar}
          >
            {salvando ? 'Salvando...' : 'Apontar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo de lote ───────────────────────────────────────────────────────
// Existe por causa da mão de obra: cada dia de cada pessoa é um registro do
// Ponto, e uma obra com cinquenta trabalhadores gera mais de mil por mês. Uma
// fila que só aceita um por vez não seria usada — e apontamento que não
// acontece devolve relatório vazio.
function DialogoLote({ linhas, servicos, filtroDescricao, onFechar, onConfirmar, salvando }) {
  const [servicoId, setServicoId] = useState('');
  const realizadas = linhas.filter((l) => l.realizado);
  const total = r2(realizadas.reduce((s, l) => s + num(l.valor_nao_apontado), 0));
  const comprometidas = linhas.length - realizadas.length;

  const opcoes = useMemo(
    () => servicos.map((s) => ({
      value: s.contrato_item_id,
      label: `${s.codigo ? `${s.codigo} · ` : ''}${s.descricao}`.slice(0, 90),
    })),
    [servicos],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Apontar em lote</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
          <p className="text-gray-900">
            <strong>{realizadas.length}</strong> despesa(s) de <strong>{filtroDescricao}</strong>, somando{' '}
            <strong>{fmt(total)}</strong>, irão para um único serviço.
          </p>
          {comprometidas > 0 && (
            <p className="text-xs text-amber-700">
              {comprometidas} despesa(s) ainda não pagas ficam de fora: o valor de um compromisso pode mudar.
            </p>
          )}
          <p className="text-[11px] text-gray-400">
            Cada despesa continua sendo uma linha própria — dá para corrigir uma delas depois sem desfazer o lote.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Serviço que recebe o custo</label>
          <ComboboxBusca
            options={opcoes}
            value={servicoId}
            onSelect={setServicoId}
            placeholder="Escolher o serviço..."
            searchPlaceholder="Buscar serviço do contrato..."
            emptyMessage="Nenhum serviço encontrado."
            buscarParaListar={opcoes.length > 60}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => onConfirmar(servicoId)} disabled={!servicoId || !realizadas.length || salvando}>
            {salvando ? 'Apontando...' : `Apontar ${realizadas.length} despesa(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba ───────────────────────────────────────────────────────────────────
export default function CustoPorServicoTab({ obraId, podeEditar = true }) {
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState('todas');
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState(null);
  const [emLote, setEmLote] = useState(false);

  const { data: fila, isLoading } = useQuery({
    queryKey: ['custos-nao-apontados', obraId, categoria, incluirPendentes],
    queryFn: async () => {
      const r = await base44.functions.invoke('getCustosNaoApontados', {
        obra_id: obraId,
        categoria: categoria === 'todas' ? null : categoria,
        incluir_pendentes: incluirPendentes,
      });
      return r.data;
    },
    enabled: !!obraId,
  });

  const { data: resumo } = useQuery({
    queryKey: ['custo-por-servico', obraId],
    queryFn: async () => {
      const r = await base44.functions.invoke('getCustoRealPorServico', { obra_id: obraId });
      return r.data;
    },
    enabled: !!obraId,
  });

  const salvar = useMutation({
    mutationFn: async ({ despesa, rateios }) => {
      const r = await base44.functions.invoke('apontarCustoServico', {
        origem_tipo: despesa.origem_tipo,
        origem_id: despesa.origem_id,
        rateios: rateios.map((l) => ({ contrato_item_id: l.contrato_item_id, valor: num(l.valor) })),
      });
      return r.data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['custos-nao-apontados', obraId] });
      queryClient.invalidateQueries({ queryKey: ['custo-por-servico', obraId] });
      // A aba Desvios lê o mesmo apontamento: sem invalidar aqui, ela seguiria
      // mostrando o número anterior até a página ser recarregada.
      queryClient.invalidateQueries({ queryKey: ['desvio-obra', obraId] });
      setEmEdicao(null);
      toast.success(
        d?.totalmente_apontado
          ? 'Despesa totalmente apontada.'
          : `Apontado ${fmt(d?.valor_apontado)} — ${fmt(d?.valor_nao_apontado)} segue sem serviço.`,
      );
      if (d?.aviso) toast.warning(d.aviso, { duration: 9000 });
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Não foi possível apontar.'),
  });

  const salvarLote = useMutation({
    mutationFn: async (contratoItemId) => {
      const r = await base44.functions.invoke('apontarCustoServicoEmLote', {
        obra_id: obraId,
        contrato_item_id: contratoItemId,
        filtro: { categoria: categoria === 'todas' ? null : categoria },
      });
      return r.data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['custos-nao-apontados', obraId] });
      queryClient.invalidateQueries({ queryKey: ['custo-por-servico', obraId] });
      queryClient.invalidateQueries({ queryKey: ['desvio-obra', obraId] });
      setEmLote(false);
      toast.success(`${d?.apontadas || 0} despesa(s) apontadas — ${fmt(d?.valor_total)}.`);
      if (d?.aviso) toast.warning(d.aviso, { duration: 9000 });
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Não foi possível apontar em lote.'),
  });

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = fila?.linhas || [];
    return q ? base.filter((l) => `${l.descricao} ${l.fornecedor || ''}`.toLowerCase().includes(q)) : base;
  }, [fila, busca]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } =
    usePagination(linhas, 12);

  const t = resumo?.totais;
  const semContrato = resumo?.sem_contrato;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <KpiCardsSkeleton count={4} />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  if (semContrato) {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-6 text-sm text-amber-800">
          <p className="font-medium mb-1">Esta obra ainda não tem contrato ativo.</p>
          <p>
            O custo real é apontado contra os serviços do contrato, que são a linha-base do desvio.
            Gere o contrato a partir do orçamento e esta aba passa a funcionar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicadores: o quanto do custo da obra já tem dono */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Kpi rotulo="Custo previsto" valor={fmt(t?.custo_previsto)} sub="linha-base do contrato" />
        <Kpi rotulo="Custo real da obra" valor={fmt(t?.custo_realizado_obra)} sub="fecha com a DRE" />
        <Kpi
          rotulo="Apontado a serviço"
          valor={fmt(t?.custo_realizado_apontado)}
          sub={`${t?.servicos_com_apontamento || 0} de ${t?.servicos_total || 0} serviços`}
          cor="text-emerald-600"
          fundo="bg-emerald-50 border-emerald-200"
        />
        <Kpi
          rotulo="Cobertura"
          valor={`${num(t?.cobertura_apontamento).toFixed(0)}%`}
          sub={
            num(t?.custo_nao_apontavel) > 0
              ? `${fmt(t?.custo_nao_apontado)} sem serviço, dos quais ${fmt(t?.custo_nao_apontavel)} ainda não apontáveis`
              : `${fmt(t?.custo_nao_apontado)} sem serviço`
          }
          cor={num(t?.cobertura_apontamento) >= 80 ? 'text-emerald-600' : 'text-amber-600'}
          fundo={num(t?.cobertura_apontamento) >= 80 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}
        />
      </div>

      {/* Lista cortada por limite. Sem este aviso a fila pareceria completa, e
          quem terminasse de classificar o que vê acharia que acabou — com
          centenas de lançamentos de ponto, isso acontece já no primeiro mês. */}
      {fila?.truncado && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            Mostrando as {fila.linhas.length} maiores despesas. Outras <strong>{fila.ocultas}</strong> não
            aparecem aqui — use os filtros de categoria para alcançá-las, ou aponte em lote.
          </span>
        </div>
      )}

      {t?.servicos_sem_previsto > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            {t.servicos_sem_previsto} serviço(s) do contrato sem custo previsto. Enquanto estiverem assim,
            não há linha-base para comparar e o desvio deles não aparece.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Buscar por descrição ou fornecedor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={incluirPendentes ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncluirPendentes((v) => !v)}
          className="shrink-0"
        >
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          {incluirPendentes ? 'Com comprometido' : 'Só pago'}
        </Button>
        {/* Lote só com categoria escolhida: mandar "tudo" para um serviço só
            seria quase sempre errado, e o erro sairia caro de desfazer. */}
        {categoria !== 'todas' && linhas.some((l) => l.realizado) && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEmLote(true)}
            disabled={!podeEditar} className="shrink-0">
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Apontar {linhas.filter((l) => l.realizado).length} de uma vez
          </Button>
        )}
      </div>

      {/* Fila */}
      {linhas.length === 0 ? (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-6 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              {busca || categoria !== 'todas'
                ? 'Nenhuma despesa pendente com esses filtros.'
                : 'Todo o custo desta obra já está apontado a um serviço.'}
            </span>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-500 text-xs">
                  <th className="text-left p-3 font-medium">Despesa</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Categoria</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Data</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-right p-3 font-medium hidden sm:table-cell">Falta apontar</th>
                  <th className="text-center p-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((l) => (
                  <tr key={`${l.origem_tipo}:${l.origem_id}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 max-w-[260px]">
                      <p className="truncate text-gray-900">{l.descricao}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {l.fornecedor && <span className="text-xs text-gray-400 truncate">{l.fornecedor}</span>}
                        {l.parcial && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            parcial · {fmt(l.valor_apontado)} apontado
                          </Badge>
                        )}
                        {!l.realizado && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                            comprometido
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-gray-600">{catLabel(l.categoria)}</td>
                    <td className="p-3 hidden lg:table-cell text-gray-500">{dataBR(l.data)}</td>
                    <td className="p-3 text-right tabular-nums text-gray-900">{fmt(l.valor)}</td>
                    <td className="p-3 text-right tabular-nums font-semibold text-amber-600 hidden sm:table-cell">
                      {fmt(l.valor_nao_apontado)}
                    </td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 h-7"
                        onClick={() => setEmEdicao(l)} disabled={!podeEditar}>
                        <Tag className="w-3.5 h-3.5 mr-1" /> Apontar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage}
            startIndex={startIndex} endIndex={endIndex} totalItems={totalItems}
          />
        </>
      )}

      {emLote && (
        <DialogoLote
          linhas={linhas}
          servicos={resumo?.servicos || []}
          filtroDescricao={catLabel(categoria)}
          salvando={salvarLote.isPending}
          onFechar={() => setEmLote(false)}
          onConfirmar={(id) => salvarLote.mutate(id)}
        />
      )}

      {emEdicao && (
        <DialogoRateio
          despesa={emEdicao}
          servicos={resumo?.servicos || []}
          salvando={salvar.isPending}
          onFechar={() => setEmEdicao(null)}
          onSalvar={(rateios) => salvar.mutate({ despesa: emEdicao, rateios })}
        />
      )}
    </div>
  );
}
