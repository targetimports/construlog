import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save, Loader2, AlertTriangle, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import GerenciadorAnexos from '@/components/shared/GerenciadorAnexos';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FormMedicaoContrato({ onSuccess, contratoIdInicial = '' }) {
  const queryClient = useQueryClient();
  const [contratoId, setContratoId] = useState(contratoIdInicial);
  const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split('T')[0]);
  const [titulo, setTitulo] = useState('');
  const [valorMedicao, setValorMedicao] = useState('');
  const [medicaoSalva, setMedicaoSalva] = useState(null);

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-form-medicao'],
    queryFn: () => base44.entities.Contrato.list('-created_date', 1000),
    staleTime: 2 * 60 * 1000,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-form-medicao'],
    queryFn: () => base44.entities.Fornecedor.list('-created_date', 2000).catch(() => []),
  });
  const fornMap = useMemo(() => Object.fromEntries(fornecedores.map((f) => [f.id, f.nome || f.razao_social])), [fornecedores]);

  const contrato = useMemo(() => contratos.find((c) => c.id === contratoId) || null, [contratos, contratoId]);

  // Medições já aprovadas deste contrato -> já medido / saldo.
  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes-contrato', contratoId],
    queryFn: () => base44.entities.MedicaoContrato.filter({ contrato_id: contratoId }, '-data_medicao', 500),
    enabled: !!contratoId,
  });

  const jaMedido = useMemo(
    () => medicoes.filter((m) => String(m.status).toLowerCase() === 'aprovada').reduce((s, m) => s + num(m.valor_medido ?? m.valor_total), 0),
    [medicoes],
  );
  const valorContrato = num(contrato?.valor_total);
  const saldo = valorContrato - jaMedido;
  const valorNum = num(valorMedicao);
  const excedeSaldo = valorNum > saldo + 0.005 && valorContrato > 0;
  const percentualMedicao = valorContrato > 0 ? ((valorNum / valorContrato) * 100) : 0;
  const percentualAcumulado = valorContrato > 0 ? (((jaMedido + valorNum) / valorContrato) * 100) : 0;

  const opcoesContrato = contratos.map((c) => ({
    value: c.id,
    label: `${c.titulo || c.numero} · ${fornMap[c.fornecedor_id] || 'Fornecedor —'} · ${fmtBRL(c.valor_total)}`,
  }));

  const aplicarPercentual = (pct) => {
    if (valorContrato > 0) setValorMedicao(((num(pct) / 100) * valorContrato).toFixed(2));
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!contratoId) throw new Error('Selecione um contrato');
      if (valorNum <= 0) throw new Error('Informe o valor desta medição');
      const payload = {
        contrato_id: contratoId,
        data_medicao: dataMedicao,
        titulo: titulo || `Medição ${new Date(dataMedicao + 'T00:00:00').toLocaleDateString('pt-BR')}`,
        valor_total: valorNum,
        percentual_acumulado: Number(percentualAcumulado.toFixed(1)),
        items: [],
        status: 'pendente',
      };
      const response = await base44.functions.invoke('criarMedicaoContrato', payload);
      return response.data?.medicao || response.data;
    },
    onSuccess: (data) => {
      toast.success('Medição criada (pendente de aprovação)');
      setMedicaoSalva(data);
      queryClient.invalidateQueries({ queryKey: ['medicoes-contrato', contratoId] });
      onSuccess?.(data);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetar = () => {
    setMedicaoSalva(null);
    setValorMedicao('');
    setTitulo('');
    setContratoId('');
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Seleção de contrato */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Contrato</label>
        <ComboboxBusca
          options={opcoesContrato}
          value={contratoId}
          onSelect={(v) => { setContratoId(v); setValorMedicao(''); }}
          placeholder="Selecione o contrato..."
          searchPlaceholder="Buscar por número, título ou fornecedor..."
          emptyMessage="Nenhum contrato encontrado."
        />
      </div>

      {!contratoId ? (
        <Card className="border-gray-200 border-dashed">
          <CardContent className="py-10 text-center text-gray-400">
            <FileSignature className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Selecione um contrato para lançar a medição.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo do contrato */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-3">
              <p className="text-xs text-gray-500">Valor do Contrato</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums break-words leading-tight">{fmtBRL(valorContrato)}</p>
            </CardContent></Card>
            <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-3">
              <p className="text-xs text-gray-500">Já Medido</p>
              <p className="text-sm sm:text-base font-bold text-emerald-600 tabular-nums break-words leading-tight">{fmtBRL(jaMedido)}</p>
            </CardContent></Card>
            <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-3">
              <p className="text-xs text-gray-500">Saldo</p>
              <p className={`text-sm sm:text-base font-bold tabular-nums break-words leading-tight ${saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmtBRL(saldo)}</p>
            </CardContent></Card>
          </div>

          {!medicaoSalva && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Data da Medição</label>
                  <Input type="date" value={dataMedicao} onChange={(e) => setDataMedicao(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Título (opcional)</label>
                  <Input placeholder="Ex: 1ª Medição" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Valor desta Medição (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorMedicao}
                  onChange={(e) => setValorMedicao(e.target.value)}
                  className="mt-1"
                />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-gray-500">Atalho:</span>
                  {[25, 50, 75, 100].map((p) => (
                    <Button key={p} type="button" variant="outline" size="sm" className="h-7 text-xs border-gray-300 text-gray-600" onClick={() => aplicarPercentual(p)}>
                      {p}%
                    </Button>
                  ))}
                  {saldo > 0 && (
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-blue-300 text-blue-700" onClick={() => setValorMedicao(saldo.toFixed(2))}>
                      Saldo restante
                    </Button>
                  )}
                </div>
                {valorNum > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Esta medição: <span className="font-semibold text-gray-700">{percentualMedicao.toFixed(1)}%</span> do contrato ·
                    Acumulado: <span className="font-semibold text-gray-700">{percentualAcumulado.toFixed(1)}%</span>
                  </p>
                )}
              </div>

              {excedeSaldo && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>O valor excede o saldo do contrato ({fmtBRL(saldo)}). Não é possível medir além do contratado — para medir mais, faça um <strong>aditivo</strong> (aumente o valor do contrato).</span>
                </div>
              )}

              <Button
                onClick={() => salvarMutation.mutate()}
                disabled={salvarMutation.isPending || valorNum <= 0 || excedeSaldo}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                {salvarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Medição
              </Button>
            </>
          )}

          {/* Após salvar: anexos + nova */}
          {medicaoSalva && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                Medição de <strong>{fmtBRL(medicaoSalva.valor_total ?? medicaoSalva.valor_medido)}</strong> criada. Anexe documentos abaixo (opcional) ou aprove na lista do contrato.
              </div>
              <GerenciadorAnexos entidadeId={medicaoSalva.id} tipoEntidade="medicao" podeEditar={true} />
              <Button onClick={resetar} variant="outline" className="w-full border-gray-300 text-gray-700">Nova Medição</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
