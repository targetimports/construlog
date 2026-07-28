import React, { useState } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/shared/Pagination';
import { Warehouse, ArrowUp, ArrowDown, RefreshCw, Package, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DialogSaidaEstoqueObra from '@/components/estoque/DialogSaidaEstoqueObra';
import DialogEntradaEstoqueObra from '@/components/estoque/DialogEntradaEstoqueObra';

const PER_PAGE = 15;
const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_ICON = {
  ENTRADA: { icon: ArrowDown, cls: 'text-emerald-600' },
  SAIDA: { icon: ArrowUp, cls: 'text-red-600' },
  TRANSFERENCIA: { icon: RefreshCw, cls: 'text-blue-600' },
  AJUSTE: { icon: RefreshCw, cls: 'text-amber-600' },
  ESTORNO: { icon: RefreshCw, cls: 'text-purple-600' },
};

export default function MateriaisEstoqueObraTab({ obraId }) {
  const [dialogConsumoOpen, setDialogConsumoOpen] = useState(false);
  const [dialogEntradaOpen, setDialogEntradaOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: locais = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['locais-estoque-obra-mat', obraId],
    queryFn: () => base44.entities.LocalEstoque.filter({ obra_id: obraId, tipo: 'OBRA' }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obra-estoque-mat', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }),
    enabled: !!obraId,
  });
  const obra = obras[0];

  const criarLocalMutation = useMutation({
    mutationFn: () => base44.entities.LocalEstoque.create({
      nome: `Almoxarifado - ${obra?.nome || 'Obra'}`,
      nivel: 'OBRA',
      tipo: 'OBRA',
      empresa_id: obra?.empresa_id || null,
      obra_id: obraId,
      obra_nome: obra?.nome || null,
      ativo: true,
    }),
    onSuccess: () => {
      toast.success('Almoxarifado da obra criado!');
      queryClient.invalidateQueries({ queryKey: ['locais-estoque-obra-mat', obraId] });
    },
    onError: (e) => toast.error('Erro ao criar almoxarifado: ' + (e?.message || 'tente novamente')),
  });

  const localObraId = locais[0]?.id;

  const { data: saldos = [], isLoading: loadingSaldos } = useQuery({
    queryKey: ['saldos-estoque-obra-mat', localObraId],
    // Fonte única = getSaldosEstoque (event-sourced + escopo por empresa), não a
    // materialização SaldoEstoque (que não tem escopo aplicado na leitura).
    queryFn: async () => {
      const res = await base44.functions.invoke('getSaldosEstoque', { local_estoque_id: localObraId });
      return res.data?.saldos || [];
    },
    enabled: !!localObraId,
    staleTime: 30000,
  });

  const { data: movimentacoes = [], isLoading: loadingMov } = useQuery({
    queryKey: ['movimentacoes-obra-mat', localObraId],
    // Movimentações que TOCAM o almoxarifado desta obra (origem OU destino), casando com o
    // saldo (que é por local). Antes filtrava por obra_id — campo de atribuição de custo que
    // pode divergir do local físico, fazendo a mov aparecer no log sem alterar o saldo.
    queryFn: async () => {
      const [porDestino, porOrigem] = await Promise.all([
        base44.entities.EstoqueMovimentacao.filter({ destino_local_id: localObraId }, '-data_mov', 20),
        base44.entities.EstoqueMovimentacao.filter({ origem_local_id: localObraId }, '-data_mov', 20),
      ]);
      const vistos = new Set();
      return [...porDestino, ...porOrigem]
        .filter((m) => (vistos.has(m.id) ? false : vistos.add(m.id)))
        .sort((a, b) => new Date(b.data_mov || 0) - new Date(a.data_mov || 0))
        .slice(0, 20);
    },
    enabled: !!localObraId,
    staleTime: 30000,
  });

  const isLoading = loadingLocal || loadingSaldos || loadingMov;

  if (isLoading) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  if (!localObraId) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="py-12 text-center">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-700 font-medium">Esta obra não possui almoxarifado vinculado.</p>
          <p className="text-xs text-gray-500 mt-2 mb-4">
            O estoque da obra fica em um Local de Estoque do tipo "Obra". Crie agora para começar a movimentar materiais nesta obra.
          </p>
          <Button
            onClick={() => criarLocalMutation.mutate()}
            disabled={criarLocalMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {criarLocalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Almoxarifado da Obra
          </Button>
        </CardContent>
      </Card>
    );
  }

  const saldosComSaldo = saldos.filter((s) => s.saldo > 0);
  const totalValor = saldosComSaldo.reduce((s, sd) => s + (sd.valor || 0), 0);

  const totalPages = Math.max(1, Math.ceil(saldosComSaldo.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = Math.min(startIndex + PER_PAGE, saldosComSaldo.length);
  const saldosPagina = saldosComSaldo.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Header com ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {saldosComSaldo.length} materiais no almoxarifado · Valor:{' '}
          <span className="font-semibold text-gray-700">{fmtBRL(totalValor)}</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => setDialogEntradaOpen(true)}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm"
          >
            <ArrowDown className="w-4 h-4" />
            Entrada de Material
          </Button>
          <Button
            onClick={() => setDialogConsumoOpen(true)}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white gap-2 text-sm"
          >
            <ArrowUp className="w-4 h-4" />
            Registrar Consumo
          </Button>
        </div>
      </div>

      {/* Saldos */}
      {saldosComSaldo.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Estoque vazio nesta obra.</p>
            <p className="text-xs text-gray-400 mt-1">Realize transferências do estoque central ou receba materiais de compras.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Unid.</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Saldo</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Custo Méd.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {saldosPagina.map((s) => (
                  <tr key={s.insumo_id || s.material_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{s.material_nome || 'Material'}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{s.material_unidade || '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-medium">{(s.saldo || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3 text-right text-gray-500">{fmtBRL(s.custo_medio)}</td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">{fmtBRL(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {saldosPagina.map((s) => (
              <div key={s.insumo_id || s.material_id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 font-medium break-words">{s.material_nome || 'Material'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(s.saldo || 0).toLocaleString('pt-BR')} {s.material_unidade || '—'} · {fmtBRL(s.custo_medio)}
                    </p>
                  </div>
                  <span className="text-sm text-gray-700 font-medium whitespace-nowrap shrink-0">{fmtBRL(s.valor)}</span>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={saldosComSaldo.length}
            />
          )}
        </div>
      )}

      {/* Últimas Movimentações */}
      {movimentacoes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Últimas Movimentações</p>
          <div className="space-y-2">
            {movimentacoes.slice(0, 10).map((mov) => {
              const tipoCfg = TIPO_ICON[mov.tipo] || TIPO_ICON.AJUSTE;
              const TipoIcon = tipoCfg.icon;
              return (
                <div key={mov.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <TipoIcon className={`w-4 h-4 flex-shrink-0 ${tipoCfg.cls}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 truncate">
                        {mov.documento_ref || mov.observacao || mov.tipo}
                      </span>
                      <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">{mov.tipo}</Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {mov.data_mov ? new Date(mov.data_mov).toLocaleDateString('pt-BR') : '—'}
                      {mov.qtd_itens ? ` · ${mov.qtd_itens} itens` : ''}
                    </p>
                  </div>
                  {mov.valor_total_movimentacao > 0 && (
                    <span className="text-sm font-medium text-gray-700">{fmtBRL(mov.valor_total_movimentacao)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog Entrada de Material (gera saldo) */}
      <DialogEntradaEstoqueObra
        obraId={obraId}
        localId={localObraId}
        open={dialogEntradaOpen}
        onClose={() => setDialogEntradaOpen(false)}
        onSuccess={() => {
          setDialogEntradaOpen(false);
          queryClient.invalidateQueries({ queryKey: ['saldos-estoque-obra-mat', localObraId] });
          queryClient.invalidateQueries({ queryKey: ['movimentacoes-obra-mat', localObraId] });
        }}
      />

      {/* Dialog Consumo reaproveitando componente existente */}
      <DialogSaidaEstoqueObra
        open={dialogConsumoOpen}
        onClose={() => setDialogConsumoOpen(false)}
        onSuccess={() => {
          setDialogConsumoOpen(false);
          queryClient.invalidateQueries({ queryKey: ['saldos-estoque-obra-mat', localObraId] });
          queryClient.invalidateQueries({ queryKey: ['movimentacoes-obra-mat', localObraId] });
        }}
        obraIdPreSelecionada={obraId}
      />
    </div>
  );
}
