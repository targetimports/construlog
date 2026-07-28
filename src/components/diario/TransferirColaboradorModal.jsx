import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { ArrowRightLeft, Info } from 'lucide-react';
import { toast } from 'sonner';

// TRANSFERIR COLABORADOR PARA OUTRA OBRA (empréstimo dentro do grupo).
//
// O que a transferência é, na prática: uma AlocacaoObra na obra de DESTINO (que já
// vincula a pessoa à equipe de lá, via adicionarColaboradorAObra) — e é isso que
// faz ela aparecer no Ponto da obra nova.
//
// O que a transferência NÃO faz, de propósito:
//  • não muda a empresa do colaborador: o vínculo, a folha e o headcount continuam
//    na empresa dele. Só o custo dos DIAS TRABALHADOS anda com a obra;
//  • não tira ele da obra de origem: ele pode dividir a semana (3 dias lá, volta e
//    fecha a semana aqui). Nos dias em que estiver emprestado, a obra de origem o
//    mostra como "Em transferência" em vez de cobrar presença.
//
// Quem decide o custo é o PONTO, não este cadastro: o dia cai na obra onde as horas
// foram lançadas. A alocação só abre a porta (coloca a pessoa na lista do Ponto).
export default function TransferirColaboradorModal({ open, onOpenChange, obraId, obraNome, colaboradores = [] }) {
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().split('T')[0];
  const [colabId, setColabId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState('');
  const [errors, setErrors] = useState({});
  const cls = (c) => (errors[c] ? 'border-red-400 focus-visible:ring-red-400' : '');
  const limparErro = (c) => setErrors((e) => (e[c] ? { ...e, [c]: undefined } : e));

  // Obras de destino. A entidade Obra é escopada por empresa: um usuário de empresa
  // vê só as obras dela; Admin/Matriz vê o grupo todo — que é quem consegue fazer a
  // transferência ENTRE empresas (a regra de isolamento é fail-closed, e mantê-la
  // vale mais do que facilitar este fluxo).
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-destino-transferencia'],
    queryFn: () => base44.entities.Obra.list('-created_date', 5000),
    enabled: open,
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-transferencia'],
    queryFn: () => base44.entities.Empresa.list('nome', 500).catch(() => []),
    enabled: open,
  });
  const empresaNome = useMemo(
    () => Object.fromEntries((empresas || []).map((e) => [e.id, e.nome])),
    [empresas]
  );

  const destinos = useMemo(
    () => (obras || [])
      .filter((o) => o.id !== obraId && !['concluida', 'cancelada'].includes(String(o.status || '').toLowerCase()))
      .map((o) => ({ value: o.id, label: empresaNome[o.empresa_id] ? `${o.nome} — ${empresaNome[o.empresa_id]}` : o.nome })),
    [obras, obraId, empresaNome]
  );
  const colabOpcoes = useMemo(
    () => colaboradores.map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} — ${c.cargo}` : c.nome })),
    [colaboradores]
  );

  const colabSel = colaboradores.find((c) => c.id === colabId);
  const obraSel = (obras || []).find((o) => o.id === destinoId);
  const outraEmpresa = !!(colabSel?.empresa_id && obraSel?.empresa_id && colabSel.empresa_id !== obraSel.empresa_id);

  const limpar = () => { setColabId(''); setDestinoId(''); setDataInicio(hoje); setDataFim(''); setErrors({}); };

  const validar = () => {
    const e = {};
    if (!colabId) e.colabId = 'Selecione o colaborador.';
    if (!destinoId) e.destinoId = 'Selecione a obra de destino.';
    if (!dataInicio) e.dataInicio = 'Informe a data de início.';
    if (dataInicio && dataFim && dataFim < dataInicio) e.dataFim = 'O retorno não pode ser antes do início.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const transferir = useMutation({
    mutationFn: async () => {
      await base44.entities.AlocacaoObra.create({
        colaborador_id: colabId,
        obra_id: destinoId,
        cargo_alocado: colabSel?.cargo || '',
        data_inicio: dataInicio,
        data_fim: dataFim || '',   // vazio = sem previsão de volta
        status: 'ativa',
        // Marca que esta alocação é um EMPRÉSTIMO, e de onde ele veio. É o que
        // permite a obra de destino mostrar "Transferido de X" + botão de encerrar,
        // e sumir com ele da lista depois do retorno previsto — sem afetar as
        // alocações comuns (uma alocação normal não deve expirar da lista assim).
        tipo: 'transferencia',
        obra_origem_id: obraId,
        obra_origem_nome: obraNome || '',
        observacoes: `Transferido de ${obraNome || 'outra obra'}`,
      });
      // Vincula à equipe da obra de destino — é o que faz aparecer no Ponto de lá.
      await base44.functions.invoke('adicionarColaboradorAObra', {
        obra_id: destinoId,
        colaborador_id: colabId,
        funcao_na_obra: colabSel?.cargo || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] || '');
        return k.includes('aloca') || k.includes('equipe') || k.includes('colaboradores-obra') || k.includes('ponto-transferidos');
      } });
      toast.success(`${colabSel?.nome || 'Colaborador'} transferido para ${obraSel?.nome || 'a obra'}. Marque o ponto dele por lá.`);
      limpar();
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err?.detail?.message || err?.response?.data?.message;
      if (err?.status === 403 || err?.response?.status === 403) {
        toast.error('Você não tem permissão para alocar nesta obra. Só responsáveis pela obra de destino (ou Admin/TI/Financeiro) podem receber o colaborador.');
        return;
      }
      toast.error(msg || 'Erro ao transferir: ' + err.message);
    },
  });

  const podeSalvar = colabId && destinoId && dataInicio && !transferir.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) limpar(); onOpenChange(v); }}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Transferir colaborador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Colaborador (de {obraNome || 'esta obra'}) *</Label>
            <ComboboxBusca
              options={colabOpcoes}
              value={colabId}
              onSelect={(v) => { setColabId(v); limparErro('colabId'); }}
              placeholder="Selecione o colaborador..."
              className={cls('colabId')}
            />
            {errors.colabId && <p className="text-xs text-red-600 mt-1">{errors.colabId}</p>}
          </div>

          <div>
            <Label className="text-xs">Transferir para a obra *</Label>
            <ComboboxBusca
              options={destinos}
              value={destinoId}
              onSelect={(v) => { setDestinoId(v); limparErro('destinoId'); }}
              placeholder="Selecione a obra de destino..."
              className={cls('destinoId')}
            />
            {errors.destinoId && <p className="text-xs text-red-600 mt-1">{errors.destinoId}</p>}
          </div>

          {/* Dois campos de data lado a lado não cabem em tela de celular — o input
              nativo tem largura mínima e empurrava o modal. Empilha no mobile. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); limparErro('dataInicio'); }} className={cls('dataInicio')} />
              {errors.dataInicio && <p className="text-xs text-red-600 mt-1">{errors.dataInicio}</p>}
            </div>
            <div>
              <Label className="text-xs">Retorno previsto</Label>
              <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); limparErro('dataFim'); }} className={cls('dataFim')} />
              {errors.dataFim
                ? <p className="text-xs text-red-600 mt-1">{errors.dataFim}</p>
                : <p className="text-[11px] text-gray-500 mt-1">Opcional — deixe vazio se não souber.</p>}
            </div>
          </div>

          {outraEmpresa && (
            <div className="flex gap-2 p-3 rounded-md bg-blue-50 border border-blue-200">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 space-y-1 min-w-0">
                {/* Nome de empresa é longo: o badge quebra para a linha de baixo em
                    vez de esticar a caixa. */}
                <p className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                  Transferência entre empresas
                  <Badge variant="outline" className="border-blue-300 bg-white text-blue-700 text-[10px] whitespace-normal text-left">
                    {empresaNome[colabSel?.empresa_id] || '—'} → {empresaNome[obraSel?.empresa_id] || '—'}
                  </Badge>
                </p>
                <p>
                  O salário e o vínculo continuam em {empresaNome[colabSel?.empresa_id] || 'a empresa dele'}.
                  Só o custo dos dias trabalhados vai para {empresaNome[obraSel?.empresa_id] || 'a outra empresa'},
                  conforme as horas marcadas no ponto.
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-500">
            Ele continua na equipe de {obraNome || 'origem'} e pode voltar a qualquer momento — basta marcar o
            ponto aqui. Nos dias em que estiver na outra obra, aparece como “Em transferência”.
          </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto h-11" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { if (!validar()) { toast.error('Verifique os campos destacados.'); return; } transferir.mutate(); }} disabled={transferir.isPending} className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700">
            {transferir.isPending ? 'Transferindo...' : 'Transferir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
