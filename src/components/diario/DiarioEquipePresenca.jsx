import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import TransferirColaboradorModal from './TransferirColaboradorModal';
import { toast } from 'sonner';
import { OPCOES_PONTO, PRESENCA_INFO, horasDaPresenca, ehPresenca, ehMeioPeriodo, fracaoDoDia } from '@/lib/presenca';

const POR_PAGINA = 15;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// 'YYYY-MM-DD' → 'DD/MM' (sem new Date: evita o fuso comer um dia).
const dataBR = (iso) => {
  const [, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : '';
};

export default function DiarioEquipePresenca({ obraId, obraNome = '', podeEditar = true }) {
  const hojeISO = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO);
  const [transferirAberto, setTransferirAberto] = useState(false);
  const [encerrarAlvo, setEncerrarAlvo] = useState(null);   // colaborador cuja transferência será encerrada
  const [busca, setBusca] = useState('');
  const [apresentando, setApresentando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  // Carregar colaboradores vinculados à obra
  const { data: obra = {} } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.get(obraId),
    enabled: !!obraId
  });

  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ['colaboradores-obra', obraId],
    queryFn: async () => {
      // Une os colaboradores vinculados diretamente à obra (ObraColaborador) com
      // os membros das equipes vinculadas à obra (Equipe.colaboradores_ids +
      // responsavel_id), sem repetir.
      const [vinculos, equipes, alocacoes, todos, terceirizados] = await Promise.all([
        base44.entities.ObraColaborador.filter({ obra_id: obraId }).catch(() => []),
        base44.entities.Equipe.filter({ obra_id: obraId }).catch(() => []),
        base44.entities.AlocacaoObra.filter({ obra_id: obraId }).catch(() => []),
        base44.entities.Colaborador.list('-created_date', 5000).catch(() => []),
        base44.entities.ProfissionalTerceirizado.filter({ obra_id: obraId }).catch(() => []),
      ]);

      const ids = new Set();
      (vinculos || [])
        .filter(v => (v.status || 'ativo') !== 'inativo')
        .forEach(v => { if (v.colaborador_id) ids.add(v.colaborador_id); });
      (equipes || [])
        .filter(e => (e.status || 'ativa') !== 'inativa')
        .forEach(eq => {
          (eq.colaboradores_ids || []).forEach(id => { if (id) ids.add(id); });
          if (eq.responsavel_id) ids.add(eq.responsavel_id);
        });
      // Alocações ativas também contam como "na obra" (cobre alocações antigas
      // sem vínculo de equipe gerado).
      (alocacoes || [])
        .filter(a => (a.status || 'ativa') !== 'finalizada' && a.status !== 'cancelada')
        .forEach(a => { if (a.colaborador_id) ids.add(a.colaborador_id); });

      const colMap = Object.fromEntries((todos || []).map(c => [c.id, c]));
      const proprios = [...ids].map(id => colMap[id]).filter(Boolean);

      // TERCEIRIZADOS da obra entram na mesma lista (marcados com `_terceirizado`).
      // EMPREITA fica FORA: ele é pago pelo serviço entregue, via medição do contrato
      // — bater ponto geraria diária e o mesmo trabalho viraria custo duas vezes.
      const tercs = (terceirizados || [])
        .filter(t => (t.status || 'ativo') === 'ativo')
        .filter(t => entraNoPonto(t))
        .map(t => ({
          ...t,
          cargo: t.funcao || 'Terceirizado',
          _terceirizado: true,
          _regime: regimeDe(t),
          _contratante: t.empresa_contratante || '',
          // O ponto usa estes campos para calcular o dia; no terceirizado eles vêm
          // do regime dele (diarista paga por dia; mensal tem valor fixo).
          tipo_pagamento: regimeDe(t) === 'DIARIA' ? 'DIARIA' : 'SALARIO_FIXO',
          valor_diaria: Number(t.valor_diaria) || 0,
          custo_hora: Number(t.valor_hora) || 0,
        }));

      return [...proprios, ...tercs].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    },
    enabled: !!obraId
  });

  // Carregar presença do dia — fonte única: ApontamentoMaoObra (obra+profissional+dia).
  const { data: presencasDia = [] } = useQuery({
    queryKey: ['diario-equipe', obraId, dataSelecionada],
    queryFn: () =>
      base44.entities.ApontamentoMaoObra.filter({
        obra_id: obraId,
        data: dataSelecionada
      }),
    enabled: !!obraId && !!dataSelecionada
  });

  // Mutation para salvar presença — grava no MESMO registro do apontamento diário
  // (ApontamentoMaoObra). O tipo de presença define as HORAS (fonte única em
  // lib/presenca): dia todo = 8h, só manhã/só tarde = 4h, falta = 0h. Todo o resto
  // (folha, hora extra, rateio por obra, DRE) lê `horas_normais` — então se ajusta só.
  //
  // DIARISTA: a diária é proporcional ao período (meio período = meia diária).
  // MENSALISTA: sem valor aqui — o custo dele está na folha.
  const salvarPresencaMutation = useMutation({
    mutationFn: async (payload) => {
      const { colaborador_id, presenca, horas_extra, observacao } = payload;
      const existente = presencasDia.find(p => p.profissional_id === colaborador_id);
      const colab = colaboradores.find(c => c.id === colaborador_id);
      const he = parseFloat(horas_extra) || 0;
      const horas = horasDaPresenca(presenca);
      const fracao = fracaoDoDia(presenca);
      const ehDiarista = String(colab?.tipo_pagamento || 'SALARIO_FIXO') === 'DIARIA';
      const vhe = ehDiarista ? (Number(colab?.custo_hora) || 0) : 0;
      const diariaCheia = Number(colab?.valor_diaria) || 0;
      const diaria = ehDiarista ? r2(diariaCheia * fracao) : 0;

      const comum = {
        presenca,
        horas_normais: horas,
        horas_extra: he,
        valor_diaria: diaria,
        valor_hora_extra: vhe,
        total_horas_extra: r2(he * vhe),
        total: r2(diaria + he * vhe),
        observacao,
      };

      // O backend devolve `_conta_sync` quando o dia já estava aprovado e a conta a
      // pagar teve de acompanhar a correção (ou não pôde, por já estar paga).
      if (existente) return await base44.entities.ApontamentoMaoObra.update(existente.id, comum);
      return await base44.entities.ApontamentoMaoObra.create({
        obra_id: obraId,
        data: dataSelecionada,
        profissional_id: colaborador_id,
        profissional_nome: colab?.nome || '',
        profissional_cargo: colab?.cargo || '',
        // NÃO mandar a empresa do colaborador: o apontamento é filho da OBRA e o
        // backend deriva `empresa_id` dela (entities.js). No empréstimo entre
        // empresas do grupo (func1 da empresaA trabalhando em obra da empresaC), o
        // vínculo dele continua na A, mas o registro pertence à obra — senão a
        // empresaC não enxergaria o próprio ponto (a entidade é escopada por empresa).
        ...comum,
        status: 'RASCUNHO',
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['diario-equipe', obraId, dataSelecionada] });
      queryClient.invalidateQueries({ queryKey: ['apontamentos-mao-obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-presenca', obraId] });

      // Dia já aprovado = dia que virou dinheiro. Corrigir em silêncio deixaria o
      // responsável sem saber que mexeu no financeiro — então cada caso é avisado.
      const s = res?._conta_sync;
      if (!s) return;
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('conta') });
      if (s.acao === 'removida') {
        toast.warning(`Dia já aprovado: a conta a pagar de ${brl(s.valor_anterior)} foi removida do financeiro.`, { duration: 8000 });
      } else if (s.acao === 'ajustada') {
        toast.warning(`Dia já aprovado: conta a pagar ajustada de ${brl(s.valor_anterior)} para ${brl(s.valor)}.`, { duration: 8000 });
      } else if (s.acao === 'mantida_paga' && s.divergente) {
        toast.error(
          `Este dia já foi PAGO (${brl(s.valor_pago)}) e o valor não muda mais. O ponto agora vale ${brl(s.valor_atual)} — acerte com o financeiro.`,
          { duration: 12000 }
        );
      }
    },
    onError: (err) => {
      // O backend recusa o mesmo dia em duas obras (409) — mostra o motivo, não o código.
      const msg = err?.detail?.message || err?.response?.data?.message;
      if (msg) { toast.error(msg); return; }
      toast.error('Erro ao salvar presença: ' + err.message);
    },
    onSettled: () => {
      // Refaz a leitura de quem está emprestado (o dia pode ter mudado em outra obra).
      queryClient.invalidateQueries({ queryKey: ['ponto-transferidos', obraId, dataSelecionada] });
    }
  });

  // Marcar todos presentes
  const marcarTodosPresentes = async () => {
    setApresentando(true);
    // Pula quem está transferido: ele não é marcado aqui enquanto o empréstimo
    // estiver aberto (o caminho de volta é Encerrar). Além disso, se já tem ponto
    // em outra obra, o backend rejeita o dia duplicado e derrubaria o lote inteiro.
    const colab_filtrados = colaboradores.filter(c =>
      (busca === '' || c.nome.toLowerCase().includes(busca.toLowerCase()))
      && !emTransferencia(c.id)
    );

    try {
      for (const colab of colab_filtrados) {
        const atual = obterPresenca(colab.id);
        await salvarPresencaMutation.mutateAsync({
          colaborador_id: colab.id,
          presenca: 'presente',
          horas_extra: atual.horas_extra,   // preserva o que já foi lançado
          observacao: atual.observacao,
        });
      }
      toast.success(`${colab_filtrados.length} colaboradores marcados como presentes (dia todo)`);
    } catch (err) {
      toast.error('Erro ao marcar presentes');
    } finally {
      setApresentando(false);
    }
  };

  // Filtrar colaboradores por busca
  // RECEBIDOS: quem está AQUI emprestado de outra obra (a ponta oposta do badge).
  // Só alocações marcadas como transferência — uma alocação comum não expira da lista.
  // Declarado ANTES de colabsFiltrados: é ele quem usa (const não pode ser lido antes).
  const { data: alocacoesTransf = [] } = useQuery({
    queryKey: ['alocacoes-transferencia', obraId],
    queryFn: async () => {
      const todas = await base44.entities.AlocacaoObra.filter({ obra_id: obraId }).catch(() => []);
      return (todas || []).filter(a => a.tipo === 'transferencia' && String(a.status || '') !== 'finalizada');
    },
    enabled: !!obraId,
  });
  const recebidoDe = (colabId) => alocacoesTransf.find(a => a.colaborador_id === colabId) || null;

  // Vigência da transferência no dia exibido. Passado o retorno previsto, ele deixa
  // de aparecer aqui (quem não preencheu data fica até encerrarem na mão).
  const transferenciaVigente = (aloc, dia) => {
    if (!aloc) return false;
    if (aloc.data_inicio && dia < String(aloc.data_inicio).slice(0, 10)) return false;
    if (aloc.data_fim && dia > String(aloc.data_fim).slice(0, 10)) return false;
    return true;
  };

  // HISTÓRICO: quem tem ponto lançado no dia exibido aparece SEMPRE, mesmo sem
  // vínculo ativo. A lista de colaboradores vem de vínculo/equipe/alocação ATIVOS —
  // então, encerrada a transferência (vínculo inativado), o emprestado sumia também
  // dos dias passados em que trabalhou aqui, e o responsável não conseguia mais ver
  // nem conferir aquelas horas. O registro é fato consumado: some-lo da tela seria
  // esconder horas que já viraram custo desta obra.
  const colabsDoDia = useMemo(() => {
    const conhecidos = new Set(colaboradores.map(c => c.id));
    const extras = [];
    for (const p of presencasDia) {
      const cid = p.profissional_id || p.colaborador_id;
      if (!cid || conhecidos.has(cid)) continue;
      conhecidos.add(cid);
      extras.push({ id: cid, nome: p.profissional_nome || 'Colaborador', cargo: p.profissional_cargo || '', _historico: true });
    }
    return extras.length ? [...colaboradores, ...extras] : colaboradores;
  }, [colaboradores, presencasDia]);

  const colabsFiltrados = useMemo(() => {
    return colabsDoDia.filter(c => {
      if (busca !== '' && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      // Emprestado a esta obra cuja vigência não cobre o dia exibido: não pertence a
      // este dia. Exceção: se já existe ponto lançado, ele continua visível — o
      // registro é fato consumado e some-lo esconderia horas que já viraram custo.
      const aloc = recebidoDe(c.id);
      if (aloc && !transferenciaVigente(aloc, dataSelecionada)) {
        return presencasDia.some(p => p.profissional_id === c.id);
      }
      return true;
    });
  }, [colabsDoDia, busca, alocacoesTransf, dataSelecionada, presencasDia]);

  // Paginação (15 por página)
  const totalPaginas = Math.max(1, Math.ceil(colabsFiltrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const colabsPagina = useMemo(
    () => colabsFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [colabsFiltrados, paginaAtual]
  );
  // Volta à página 1 quando a busca/lista muda.
  useEffect(() => { setPagina(1); }, [busca, colaboradores.length]);

  // EM TRANSFERÊNCIA (empréstimo entre obras/empresas do grupo).
  // O colaborador pode dividir a semana: 3 dias emprestado a outra obra, volta e
  // fecha a semana aqui. Então ele NÃO sai da lista — só fica marcado nos dias em
  // que já foi apontado em outra obra. Sem isso o responsável ficava sem saída:
  // ou ignorava a linha em branco (virava "ponto esquecido") ou marcava falta —
  // e falta é dado errado, porque o cara estava trabalhando, só que em outro lugar.
  // Base: as HORAS lançadas (fonte de verdade do custo), não uma flag no cadastro.
  const { data: transferidos = {} } = useQuery({
    queryKey: ['ponto-transferidos', obraId, dataSelecionada],
    // Via function: a entidade é escopada por empresa, então a obraA não enxergaria
    // sozinha o apontamento feito numa obra da empresaC.
    queryFn: async () => {
      const r = await base44.functions.invoke('getTransferenciasDoDia', {
        obra_id: obraId,
        data: dataSelecionada,
        colaboradores_ids: colaboradores.map(c => c.id),
      });
      return r?.data?.transferidos || r?.transferidos || {};
    },
    enabled: !!obraId && !!dataSelecionada && colaboradores.length > 0,
  });
  const emTransferencia = (colabId) => transferidos[colabId] || null;

  // Encerra dos DOIS lados: quem pegou emprestado devolve (obra = esta) e quem
  // emprestou chama de volta (obra = a de destino, que vem no badge).
  const encerrarTransferencia = useMutation({
    mutationFn: ({ colaborador_id, obra_destino }) =>
      base44.functions.invoke('encerrarTransferenciaObra', {
        obra_id: obra_destino || obraId,
        colaborador_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] || '');
        return k.includes('aloca') || k.includes('equipe') || k.includes('colaboradores-obra') || k.includes('ponto-transferidos');
      } });
      toast.success('Transferência encerrada. Ele sai da lista desta obra; os dias já lançados continuam sendo daqui.');
    },
    onError: (err) => {
      const msg = err?.detail?.message || err?.response?.data?.message;
      toast.error(msg || 'Erro ao encerrar transferência: ' + err.message);
    },
  });

  // APROVAÇÃO DAS DIÁRIAS — antes isto vivia na aba "Diárias (Diaristas)", que era
  // uma segunda porta para o MESMO ApontamentoMaoObra. A aba saiu, mas a aprovação
  // não podia sair junto: é ela que gera a conta a pagar do diarista. Sem isso, o
  // ponto seria marcado e ninguém receberia.
  // Mensalista não entra: o custo dele está na folha (aprovar geraria dobra).
  const diariasPendentes = presencasDia.filter((p) => {
    const colab = colaboradores.find((c) => c.id === p.profissional_id);
    const ehDiarista = String(colab?.tipo_pagamento || 'SALARIO_FIXO') === 'DIARIA';
    return ehDiarista && String(p.status || 'RASCUNHO') !== 'APROVADO' && Number(p.total) > 0;
  });
  const totalPendente = diariasPendentes.reduce((s, p) => s + (Number(p.total) || 0), 0);

  const aprovarDiarias = useMutation({
    mutationFn: async () => {
      const res = [];
      for (const p of diariasPendentes) {
        const r = await base44.functions.invoke('aprovarApontamentoMaoObra', { apontamento_id: p.id });
        res.push(r?.data);
      }
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['diario-equipe', obraId, dataSelecionada] });
      queryClient.invalidateQueries({ queryKey: ['apontamentos-mao-obra', obraId] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('conta') });
      toast.success(`${res.length} diária(s) aprovada(s) — ${brl(totalPendente)} lançado(s) em contas a pagar.`);
    },
    onError: (e) => toast.error('Erro ao aprovar diárias: ' + (e?.message || e)),
  });

  // Obter presença de um colaborador (o tipo vem direto do campo `presenca`)
  const obterPresenca = (colabId) => {
    const r = presencasDia.find(p => p.profissional_id === colabId);
    return {
      presenca: r?.presenca || '',
      horas_extra: r?.horas_extra || 0,
      observacao: r?.observacao || ''
    };
  };

  // Estatísticas do dia. "Presentes" conta dia todo + meio período (quem trabalhou);
  // "Horas do dia" é o que realmente vai para a folha/rateio.
  const stats = {
    total: colabsFiltrados.length,
    // Emprestados a outra obra hoje (por ponto lá ou por transferência aberta):
    // não são falta nem ponto esquecido.
    transferidos: colabsFiltrados.filter(c => transferidos[c.id]).length,
    presentes: presencasDia.filter(p => ehPresenca(p.presenca)).length,
    meioPeriodo: presencasDia.filter(p => ehMeioPeriodo(p.presenca)).length,
    faltas: presencasDia.filter(p => p.presenca === 'falta').length,
    horasDia: presencasDia.reduce((s, p) => s + (Number(p.horas_normais) || 0), 0),
    horasExtra: presencasDia.reduce((sum, p) => sum + (p.horas_extra || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Presença / Ponto</h2>
          <p className="text-sm text-gray-600 mt-1 hidden sm:block">Marcação de presença e horas por colaborador</p>
        </div>
        <div className="w-full sm:w-40">
          <Label className="text-xs text-gray-600">Data</Label>
          {/* Sem data FUTURA: ponto é registro do que aconteceu. Marcar presença de
              amanhã é ficção — e ainda geraria diária a pagar por um dia que não
              existiu. Voltar em dias passados continua livre: corrigir esquecimento
              do encarregado é o uso normal do canteiro. */}
          <Input
            type="date"
            value={dataSelecionada}
            max={hojeISO}
            onChange={(e) => {
              const v = e.target.value;
              if (v && v > hojeISO) {
                toast.error('Não dá para lançar ponto em data futura.');
                setDataSelecionada(hojeISO);
                return;
              }
              setDataSelecionada(v);
            }}
            className="mt-1"
          />
        </div>
      </div>

      {/* APROVAÇÃO DAS DIÁRIAS DO DIA — o passo que transforma o ponto do diarista
          em conta a pagar. Só aparece quando há algo a aprovar. */}
      {diariasPendentes.length > 0 && podeEditar && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>{diariasPendentes.length}</strong> diária(s) de diarista neste dia ainda não aprovada(s) —
              somam <strong>{brl(totalPendente)}</strong>. Aprovar gera a conta a pagar de cada um.
            </span>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            onClick={() => aprovarDiarias.mutate()}
            disabled={aprovarDiarias.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {aprovarDiarias.isPending ? 'Aprovando...' : 'Aprovar diárias do dia'}
          </Button>
        </div>
      )}

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600">Total de colaboradores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.presentes}</div>
            <div className="text-xs text-gray-600">
              Presentes{stats.meioPeriodo > 0 ? ` (${stats.meioPeriodo} meio período)` : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.faltas}</div>
            <div className="text-xs text-gray-600">
              Faltas{stats.transferidos > 0 ? ` · ${stats.transferidos} em transferência` : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900">{stats.horasDia.toFixed(1)}h</div>
            <div className="text-xs text-gray-600">
              Horas do dia{stats.horasExtra > 0 ? ` + ${stats.horasExtra.toFixed(1)}h extra` : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS E AÇÕES */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        {podeEditar && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={marcarTodosPresentes}
              disabled={colabsFiltrados.length === 0 || apresentando}
              className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
              size="sm"
            >
              {apresentando ? 'Processando...' : '✓ Marcar Todos Presentes'}
            </Button>
            <Button
              onClick={() => setTransferirAberto(true)}
              disabled={colaboradores.length === 0}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none"
              title="Emprestar um colaborador para outra obra do grupo"
            >
              <ArrowRightLeft className="w-4 h-4 mr-1.5" />
              Transferir
            </Button>
          </div>
        )}
      </div>

      <TransferirColaboradorModal
        open={transferirAberto}
        onOpenChange={setTransferirAberto}
        obraId={obraId}
        obraNome={obraNome}
        colaboradores={colaboradores}
      />

      <AlertDialog open={!!encerrarAlvo} onOpenChange={(v) => { if (!v) setEncerrarAlvo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar transferência?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                {encerrarAlvo?._destino ? (
                  // Encerrando pelo lado de QUEM EMPRESTOU: ele volta para cá.
                  <p>
                    <span className="font-medium text-gray-900">{encerrarAlvo?.nome}</span> deixa de
                    aparecer em{' '}
                    <span className="font-medium text-gray-900">{encerrarAlvo?._destinoNome || 'a outra obra'}</span>
                    {' '}e volta a ser marcado aqui.
                  </p>
                ) : (
                  // Encerrando pelo lado de QUEM PEGOU EMPRESTADO: ele volta para a origem.
                  <p>
                    <span className="font-medium text-gray-900">{encerrarAlvo?.nome}</span> sai da lista
                    desta obra e volta a ser marcado somente em{' '}
                    <span className="font-medium text-gray-900">{encerrarAlvo?._origemNome || 'a obra de origem'}</span>.
                  </p>
                )}
                <p>
                  Os dias já lançados não mudam — o custo de cada dia continua na obra em que o
                  ponto foi batido. Se precisar, dá para transferir de novo depois.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                encerrarTransferencia.mutate({ colaborador_id: encerrarAlvo.id, obra_destino: encerrarAlvo._destino });
                setEncerrarAlvo(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Encerrar transferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TABELA DE PRESENÇA */}
      {loadingColabs ? (
        <div className="text-center py-8 text-gray-600">Carregando colaboradores...</div>
      ) : colabsFiltrados.length === 0 ? (
        <div className="flex items-center gap-2 p-8 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nenhum colaborador encontrado</p>
            <p className="text-sm">Verifique a vinculação de colaboradores com esta obra.</p>
          </div>
        </div>
      ) : (
        <>
        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-700 font-semibold">
                <th className="p-3">Nome</th>
                <th className="p-3 text-center">Presença</th>
                <th className="p-3 text-center">Horas</th>
                <th className="p-3 text-left">Horas Extra</th>
                <th className="p-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {colabsPagina.map((colab) => {
                const presenca = obterPresenca(colab.id);
                const isLoading = salvarPresencaMutation.isPending;
                const transf = emTransferencia(colab.id);      // foi emprestado a outra obra
                const emprestado = recebidoDe(colab.id);       // veio emprestado para cá

                return (
                  <tr key={colab.id} className={`hover:bg-gray-50 ${transf ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-3 font-medium text-gray-900">
                      {colab.nome}
                      {colab._terceirizado && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-medium">
                            Terceirizado
                          </Badge>
                          <span className="text-[11px] text-gray-400">
                            {colab._regime === 'MENSAL' ? 'mensal' : 'diária'}
                            {colab._contratante ? ` · ${colab._contratante}` : ''}
                          </span>
                        </span>
                      )}
                      {transf && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-medium">
                            Em transferência
                          </Badge>
                          <span className="text-[11px] text-gray-500">
                            em {transf.obra_nome}
                            {transf.via === 'alocacao' ? ' · sem ponto lançado ainda' : ` · ${transf.horas}h`}
                          </span>
                          {/* Só quando existe transferência formal: um ponto avulso em
                              outra obra não é empréstimo e não deve oferecer encerrar. */}
                          {podeEditar && transf.alocacao_id && (
                            <button
                              type="button"
                              onClick={() => setEncerrarAlvo({ ...colab, _destino: transf.obra_id, _destinoNome: transf.obra_nome })}
                              disabled={encerrarTransferencia.isPending}
                              className="text-[11px] text-blue-700 hover:underline font-medium"
                            >
                              Encerrar
                            </button>
                          )}
                        </div>
                      )}
                      {colab._historico && !emprestado && (
                        <div className="mt-1">
                          <Badge variant="outline" className="border-gray-300 bg-gray-50 text-gray-600 text-[10px] font-medium">
                            Registro histórico — não está mais na equipe
                          </Badge>
                        </div>
                      )}
                      {!transf && emprestado && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-medium">
                            Emprestado
                          </Badge>
                          <span className="text-[11px] text-gray-500">
                            de {emprestado.obra_origem_nome || 'outra obra'}
                            {emprestado.data_fim ? ` · retorno ${dataBR(emprestado.data_fim)}` : ''}
                          </span>
                          {podeEditar && (
                            <button
                              type="button"
                              onClick={() => setEncerrarAlvo({ ...colab, _origemNome: emprestado.obra_origem_nome })}
                              disabled={encerrarTransferencia.isPending}
                              className="text-[11px] text-blue-700 hover:underline font-medium"
                            >
                              Encerrar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {/* Enquanto a transferência estiver aberta, não se marca presença
                          aqui: o caminho de volta é ENCERRAR. Evita o meio-termo em que
                          o mesmo dia era disputado por duas obras. */}
                      {transf ? (
                        <span className="text-xs text-gray-500">
                          {transf.via === 'ponto'
                            ? `Ponto lançado em outra obra (${transf.horas}h)`
                            : 'Transferido — encerre para marcar aqui'}
                        </span>
                      ) : (
                      <SeletorPresenca
                        valor={presenca.presenca}
                        disabled={isLoading || !podeEditar}
                        onChange={(v) => salvarPresencaMutation.mutate({
                          colaborador_id: colab.id,
                          presenca: v,
                          horas_extra: presenca.horas_extra,
                          observacao: presenca.observacao,
                        })}
                      />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-semibold tabular-nums ${horasDaPresenca(presenca.presenca) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {transf ? '—' : (presenca.presenca ? `${horasDaPresenca(presenca.presenca)}h` : '—')}
                      </span>
                    </td>
                    <td className="p-3">
                      {transf ? <span className="text-xs text-gray-300">—</span> : (
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={presenca.horas_extra}
                        onChange={(e) => {
                          salvarPresencaMutation.mutate({
                            colaborador_id: colab.id,
                            presenca: presenca.presenca,
                            horas_extra: e.target.value,
                            observacao: presenca.observacao
                          });
                        }}
                        disabled={isLoading || !podeEditar}
                        className="w-20 text-right text-xs"
                        placeholder="0.0"
                      />
                      )}
                    </td>
                    <td className="p-3">
                      {transf ? <span className="text-xs text-gray-300">—</span> : (
                      <Input
                        type="text"
                        value={presenca.observacao}
                        onChange={(e) => {
                          salvarPresencaMutation.mutate({
                            colaborador_id: colab.id,
                            presenca: presenca.presenca,
                            horas_extra: presenca.horas_extra,
                            observacao: e.target.value
                          });
                        }}
                        disabled={isLoading || !podeEditar}
                        placeholder="Ex: atrasou, bom desempenho..."
                        className="text-xs"
                      />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards de marcação */}
        <div className="md:hidden space-y-2">
          {colabsPagina.map((colab) => {
            const presenca = obterPresenca(colab.id);
            const isLoading = salvarPresencaMutation.isPending;
            const transf = emTransferencia(colab.id);
            const emprestadoM = recebidoDe(colab.id);
            if (transf) {
              return (
                <div key={colab.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50/40">
                  <p className="font-medium text-gray-900 truncate">{colab.nome}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] font-medium">
                      Em transferência
                    </Badge>
                    <span className="text-[11px] text-gray-500">
                      em {transf.obra_nome}
                      {transf.via === 'alocacao' ? ' · sem ponto lançado ainda' : ` · ${transf.horas}h`}
                    </span>
                    {podeEditar && transf.alocacao_id && (
                      <button
                        type="button"
                        onClick={() => setEncerrarAlvo({ ...colab, _destino: transf.obra_id, _destinoNome: transf.obra_nome })}
                        disabled={encerrarTransferencia.isPending}
                        className="text-[11px] text-blue-700 hover:underline font-medium"
                      >
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={colab.id} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 truncate">
                    {colab.nome}
                    {colab._terceirizado && (
                      <Badge variant="outline" className="ml-1.5 border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-medium">
                        Terceirizado
                      </Badge>
                    )}
                  </p>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${horasDaPresenca(presenca.presenca) > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                    {presenca.presenca ? `${horasDaPresenca(presenca.presenca)}h` : '—'}
                  </span>
                </div>
                {emprestadoM && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-medium">
                      Emprestado
                    </Badge>
                    <span className="text-[11px] text-gray-500">
                      de {emprestadoM.obra_origem_nome || 'outra obra'}
                      {emprestadoM.data_fim ? ` · retorno ${dataBR(emprestadoM.data_fim)}` : ''}
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => setEncerrarAlvo({ ...colab, _origemNome: emprestadoM.obra_origem_nome })}
                        disabled={encerrarTransferencia.isPending}
                        className="text-[11px] text-blue-700 hover:underline font-medium"
                      >
                        Encerrar
                      </button>
                    )}
                  </div>
                )}
                <SeletorPresenca
                  valor={presenca.presenca}
                  disabled={isLoading || !podeEditar}
                  onChange={(v) => salvarPresencaMutation.mutate({
                    colaborador_id: colab.id,
                    presenca: v,
                    horas_extra: presenca.horas_extra,
                    observacao: presenca.observacao,
                  })}
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={presenca.horas_extra}
                    onChange={(e) => {
                      salvarPresencaMutation.mutate({
                        colaborador_id: colab.id,
                        presenca: presenca.presenca,
                        horas_extra: e.target.value,
                        observacao: presenca.observacao
                      });
                    }}
                    disabled={isLoading || !podeEditar}
                    className="w-24 text-right text-xs"
                    placeholder="HE"
                    title="Horas extra"
                  />
                  <Input
                    type="text"
                    value={presenca.observacao}
                    onChange={(e) => {
                      salvarPresencaMutation.mutate({
                        colaborador_id: colab.id,
                        presenca: presenca.presenca,
                        horas_extra: presenca.horas_extra,
                        observacao: e.target.value
                      });
                    }}
                    disabled={isLoading || !podeEditar}
                    placeholder="Observação..."
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginação (compartilhada tabela/cards; empilha no mobile) */}
        {colabsFiltrados.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
            <span className="text-xs text-gray-500">
              Mostrando {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, colabsFiltrados.length)} de {colabsFiltrados.length}
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                className="h-8 gap-1 border-gray-300 text-gray-700"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span className="text-xs text-gray-600">Página {paginaAtual} de {totalPaginas}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                className="h-8 gap-1 border-gray-300 text-gray-700"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

// Seletor de presença do dia: Dia todo (8h) · Manhã (4h) · Tarde (4h) · Falta (0h).
// As horas de cada opção vêm da fonte única (lib/presenca) — é o que alimenta a
// folha, o rateio por obra e a DRE. Clicar na opção já marcada desmarca (limpa o dia).
function SeletorPresenca({ valor, onChange, disabled }) {
  const cor = (v) => {
    if (valor !== v) return 'bg-white text-gray-600 hover:bg-gray-50';
    if (v === 'falta') return 'bg-red-600 text-white';
    if (v === 'presente') return 'bg-green-600 text-white';
    return 'bg-amber-500 text-white'; // meio período
  };
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden divide-x divide-gray-300">
      {OPCOES_PONTO.map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          title={`${PRESENCA_INFO[v].label} — ${PRESENCA_INFO[v].horas}h`}
          onClick={() => onChange(valor === v ? '' : v)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${cor(v)}`}
        >
          {PRESENCA_INFO[v].curto}
        </button>
      ))}
    </div>
  );
}