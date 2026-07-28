import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { AlertTriangle, Truck } from 'lucide-react';
import { toast } from 'sonner';

// TRANSPORTE DA MÁQUINA — a retroescavadeira vai em cima do caminhão.
// Cria a mesma Viagem da transferência de material, mudando só a carga: o que viaja
// é o ativo emprestado. O motorista acompanha em "Viagens de Entrega" do mesmo jeito.

const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export default function TransporteAtivoModal({ open, emprestimo, sentido = "IDA", onClose, onCriado }) {
  const qc = useQueryClient();
  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [km, setKm] = useState('');
  const [errors, setErrors] = useState({});

  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500).catch(() => []),
    enabled: open,
  });
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 1000).catch(() => []),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setVeiculoId(''); setMotoristaId(''); setKm('');
  }, [open, emprestimo?.id]);

  // Veículos livres, MENOS o próprio ativo que está sendo transportado — um caminhão
  // não carrega a si mesmo, e oferecer isso só geraria erro depois.
  const veiculoOptions = useMemo(
    () => ativos
      .filter((a) => /veiculo/.test(String(a.tipo || '')) && a.status === 'disponivel' && a.id !== emprestimo?.ativo_id)
      .map((a) => ({ value: a.id, label: `${a.nome || a.codigo}${a.placa ? ` — ${a.placa}` : ''}` })),
    [ativos, emprestimo?.ativo_id],
  );
  const motoristaOptions = useMemo(() => {
    const ativosCol = colaboradores.filter((c) => (c.status || 'ativo') === 'ativo');
    const mots = ativosCol.filter((c) => /motorista|condutor/i.test(`${c.cargo || ''} ${c.funcao || ''}`));
    return (mots.length ? mots : ativosCol).map((c) => ({ value: c.id, label: c.nome }));
  }, [colaboradores]);

  const ehRetorno = String(sentido).toUpperCase() === 'RETORNO';
  const veiculoSel = ativos.find((a) => a.id === veiculoId);
  const kmAtual = Number(veiculoSel?.km_atual) || 0;
  const kmMenor = km !== '' && kmAtual > 0 && Number(km) < kmAtual;

  const criar = useMutation({
    mutationFn: (payload) => base44.functions.invoke('iniciarViagemTransporteAtivo', payload),
    onSuccess: (res) => {
      const d = res.data || {};
      if (d.success === false) { toast.error(d.error || 'Não foi possível criar o transporte.'); return; }
      qc.invalidateQueries({ queryKey: ['emprestimos-ativos'] });
      qc.invalidateQueries({ queryKey: ['ativos'] });
      qc.invalidateQueries({ queryKey: ['minhas-viagens'] });
      toast.success(`${ehRetorno ? 'Retirada' : 'Transporte'} ${d.numero} criada — o motorista já vê em Viagens de Entrega.`);
      onCriado?.(d);
      onClose?.();
    },
    onError: (e) => toast.error('Erro: ' + (e?.response?.data?.error || e?.message || e)),
  });

  const salvar = () => {
    const e = {};
    if (!veiculoId) e.veiculo = 'Selecione o veículo que fará o transporte.';
    if (!motoristaId) e.motorista = 'Selecione o motorista.';
    if (kmMenor) e.km = 'A leitura é menor que o hodômetro do veículo.';
    setErrors(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }
    criar.mutate({
      emprestimo_id: emprestimo.id,
      sentido,
      veiculo_id: veiculoId,
      motorista_id: motoristaId,
      km_saida: km !== '' ? Number(km) : undefined,
    });
  };

  if (!emprestimo) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            {ehRetorno ? 'Buscar de volta' : 'Transportar'} {emprestimo.ativo_nome}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {emprestimo.numero} · {ehRetorno
              ? `de ${emprestimo.obra_nome} para o pátio`
              : `destino: ${emprestimo.obra_nome}`}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            {ehRetorno
              ? <>A obra encerrou o uso. Esta viagem <strong>busca a máquina na obra</strong> e a traz de volta ao pátio.</>
              : <>A máquina viaja como carga até a obra.</>}{' '}
            O <strong>veículo transportador</strong> fica indisponível até o fim da viagem;
            o motorista acompanha em Viagens de Entrega e registra a chegada.
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Veículo transportador *</Label>
            <ComboboxBusca
              options={veiculoOptions} value={veiculoId}
              onSelect={(v) => { setVeiculoId(v); setErrors((p) => ({ ...p, veiculo: null })); }}
              placeholder="Selecione o caminhão/prancha" searchPlaceholder="Buscar veículo..."
              emptyMessage="Nenhum veículo disponível"
              className={errors.veiculo ? 'border-red-400' : ''}
            />
            {errors.veiculo && <p className="text-xs text-red-500 mt-1">{errors.veiculo}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Motorista *</Label>
            <ComboboxBusca
              options={motoristaOptions} value={motoristaId}
              onSelect={(v) => { setMotoristaId(v); setErrors((p) => ({ ...p, motorista: null })); }}
              placeholder="Selecione o motorista" searchPlaceholder="Buscar motorista..."
              emptyMessage="Nenhum colaborador"
              className={errors.motorista ? 'border-red-400' : ''}
            />
            {errors.motorista && <p className="text-xs text-red-500 mt-1">{errors.motorista}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Hodômetro de saída (km)</Label>
            <Input
              type="number" placeholder="Leitura do painel" value={km}
              onChange={(e) => setKm(e.target.value)}
              className={kmMenor ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {veiculoSel && !kmMenor && (
              <p className="text-xs text-gray-400 mt-1">Atual: {fmtNum(kmAtual)} km.</p>
            )}
            {kmMenor && (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Menor que o hodômetro atual ({fmtNum(kmAtual)} km).
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto h-11" onClick={onClose}>Cancelar</Button>
          <Button className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700" onClick={salvar} disabled={criar.isPending || kmMenor}>
            {criar.isPending ? 'Criando...' : 'Criar transporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
