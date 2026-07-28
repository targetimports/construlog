import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, CheckCircle2, Fuel, Plus, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  aguardando_saida: { label: 'Aguardando Saída', color: 'bg-amber-100 text-amber-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  finalizada: { label: 'Finalizada', color: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' }
};
const statusBadge = (s) => statusConfig[s] || { label: s || '—', color: 'bg-gray-100 text-gray-700' };
const fmtDataHora = (d) => (d && !isNaN(new Date(d)) ? new Date(d).toLocaleString('pt-BR') : '—');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moeda = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Campo({ titulo, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{titulo}</p>
      <p className="font-semibold text-gray-900 break-words">{children ?? '—'}</p>
    </div>
  );
}

export default function ViagemDetalhesModal({ id, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [showNovoAbastecimento, setShowNovoAbastecimento] = useState(false);
  const [modoIniciar, setModoIniciar] = useState(false);
  const [modoFinalizar, setModoFinalizar] = useState(false);
  const [kmInicial, setKmInicial] = useState('');
  const [combustivelInicial, setCombustivelInicial] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const [combustivelFinal, setCombustivelFinal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [novoAbastecimento, setNovoAbastecimento] = useState({ litros: '', valor_litro: '', valor_total: '', posto: '' });

  const { data: viagem, isLoading } = useQuery({
    queryKey: ['viagem', id],
    queryFn: async () => { const todas = await base44.entities.Viagem.list(); return todas.find(v => v.id === id); }
  });
  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abastecimentos', id],
    queryFn: async () => { const todos = await base44.entities.Abastecimento.list(); return todos.filter(a => a.viagem_id === id); }
  });
  const { data: veiculos = [] } = useQuery({ queryKey: ['veiculos'], queryFn: () => base44.entities.Veiculo.list() });
  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const refrescarViagem = () => {
    queryClient.invalidateQueries({ queryKey: ['viagem', id] });
    queryClient.invalidateQueries({ queryKey: ['viagens-lista'] });
    queryClient.invalidateQueries({ queryKey: ['viagens'] });
  };
  const refrescarAbastecimentos = () => {
    queryClient.invalidateQueries({ queryKey: ['abastecimentos', id] });
    queryClient.invalidateQueries({ queryKey: ['abastecimentos'] });
  };

  const iniciarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('iniciarViagem', {
      viagem_id: id,
      km_inicial: kmInicial ? parseInt(kmInicial, 10) : 0,
      combustivel_inicial_percent: combustivelInicial ? parseInt(combustivelInicial, 10) : null
    }),
    onSuccess: () => { toast.success('Viagem iniciada!'); refrescarViagem(); setModoIniciar(false); },
    onError: (e) => toast.error('Erro ao iniciar: ' + (e?.response?.data?.error || e.message))
  });

  const finalizarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('finalizarViagem', {
      viagem_id: id,
      km_inicial: kmInicial !== '' ? parseInt(kmInicial, 10) : null,
      km_final: kmFinal !== '' ? parseInt(kmFinal, 10) : null,
      combustivel_inicial_percent: combustivelInicial !== '' ? parseInt(combustivelInicial, 10) : null,
      combustivel_final_percent: combustivelFinal !== '' ? parseInt(combustivelFinal, 10) : null,
      observacoes
    }),
    onSuccess: () => {
      toast.success('Viagem salva!');
      refrescarViagem();
      // O relatório de KM lê destas chaves — invalida para refletir na hora.
      queryClient.invalidateQueries({ queryKey: ['viagens-rel'] });
      setModoFinalizar(false);
      onSuccess?.();
    },
    onError: (e) => toast.error('Erro ao finalizar: ' + (e?.response?.data?.error || e.message))
  });

  // Abre o formulário de finalização/correção já preenchido com o que existe.
  const abrirFinalizar = () => {
    setKmInicial(viagem?.km_inicial != null ? String(viagem.km_inicial) : '');
    setKmFinal(viagem?.km_final != null ? String(viagem.km_final) : '');
    setCombustivelInicial(viagem?.combustivel_inicial_percent != null ? String(viagem.combustivel_inicial_percent) : '');
    setCombustivelFinal(viagem?.combustivel_final_percent != null ? String(viagem.combustivel_final_percent) : '');
    setObservacoes(viagem?.observacoes || '');
    setModoFinalizar(true);
  };

  const adicionarAbastecimentoMutation = useMutation({
    mutationFn: () => {
      const litros = num(novoAbastecimento.litros);
      const valorLitro = num(novoAbastecimento.valor_litro);
      const valorTotal = novoAbastecimento.valor_total ? num(novoAbastecimento.valor_total) : litros * valorLitro;
      return base44.entities.Abastecimento.create({
        viagem_id: id, veiculo_id: viagem?.veiculo_id || null,
        data: new Date().toISOString().split('T')[0],
        litros, valor_litro: valorLitro, valor_total: valorTotal, posto: novoAbastecimento.posto
      });
    },
    onSuccess: () => { toast.success('Abastecimento registrado!'); refrescarAbastecimentos(); setNovoAbastecimento({ litros: '', valor_litro: '', valor_total: '', posto: '' }); setShowNovoAbastecimento(false); },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deletarAbastecimentoMutation = useMutation({
    mutationFn: (aId) => base44.entities.Abastecimento.delete(aId),
    onSuccess: () => { toast.success('Abastecimento removido'); refrescarAbastecimentos(); },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  if (isLoading) {
    return <Dialog open onOpenChange={onClose}><DialogContent>Carregando...</DialogContent></Dialog>;
  }
  if (!viagem) return null;

  const st = statusBadge(viagem.status);
  const totalAbastecimento = abastecimentos.reduce((s, a) => s + (a.valor_total || 0), 0);
  const totalLitros = abastecimentos.reduce((s, a) => s + (a.litros || 0), 0);
  const veiculoPlaca = viagem.veiculo_placa || veiculos.find(v => v.id === viagem.veiculo_id)?.placa
    || (viagem.veiculo_id ? `#${String(viagem.veiculo_id).substring(0, 8)}` : '—');
  const origem = viagem.origem_endereco || viagem.origem || null;
  const destino = viagem.destino || viagem.endereco_destino || null;
  const descricao = viagem.descricao_carga || viagem.motivo || null;
  const pct = (v) => (v != null && v !== '' ? `${v}%` : '—');
  const ehDonoOuAdmin = viagem.motorista_user_id === user?.email || ['admin', 'programador'].includes(user?.role);
  const podeEditar = ehDonoOuAdmin && viagem.status !== 'finalizada';
  // Corrigir KM/combustível é permitido também em viagem finalizada (ex.: rota
  // iniciada por GPS que não capturou o KM inicial).
  const podeCorrigirKM = ehDonoOuAdmin;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Viagem #{String(id).substring(0, 8).toUpperCase()}
            <Badge className={`border-0 ${st.color}`}>{st.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info básica */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo titulo="Motorista">{viagem.motorista_user_id || viagem.motorista_id}</Campo>
              <Campo titulo="Veículo">{veiculoPlaca}</Campo>
              {(origem || destino) && <>
                <Campo titulo="Origem"><span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600" />{origem || '—'}</span></Campo>
                <Campo titulo="Destino"><span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-600" />{destino || '—'}</span></Campo>
              </>}
              <Campo titulo="Saída Real">{fmtDataHora(viagem.saida_real)}</Campo>
              <Campo titulo="Retorno Real">{fmtDataHora(viagem.retorno_real)}</Campo>
              {descricao && <div className="sm:col-span-2"><Campo titulo="Descrição / Motivo">{descricao}</Campo></div>}
            </CardContent>
          </Card>

          {/* KM e Combustível */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Campo titulo="KM Inicial">{viagem.km_inicial ?? '—'}</Campo>
              <Campo titulo="KM Final">{viagem.km_final ?? '—'}</Campo>
              <Campo titulo="Comb. Inicial">{pct(viagem.combustivel_inicial_percent)}</Campo>
              <Campo titulo="Comb. Final">{pct(viagem.combustivel_final_percent)}</Campo>
            </CardContent>
          </Card>

          {/* Ações: Iniciar (aguardando_saida) */}
          {viagem.status === 'aguardando_saida' && podeEditar && (
            !modoIniciar ? (
              <Button onClick={() => setModoIniciar(true)} className="w-full bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" /> Iniciar Viagem
              </Button>
            ) : (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="mb-1 block">KM Inicial</Label><Input type="number" className="h-11" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} /></div>
                    <div><Label className="mb-1 block">Combustível Inicial %</Label><Input type="number" min="0" max="100" className="h-11" value={combustivelInicial} onChange={(e) => setCombustivelInicial(e.target.value)} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setModoIniciar(false)} className="flex-1">Cancelar</Button>
                    <Button onClick={() => iniciarMutation.mutate()} disabled={iniciarMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">{iniciarMutation.isPending ? 'Iniciando...' : 'Confirmar Início'}</Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Ações: Finalizar (em_andamento) ou Corrigir KM (finalizada) */}
          {((viagem.status === 'em_andamento' && podeEditar) || (viagem.status === 'finalizada' && podeCorrigirKM)) && (
            !modoFinalizar ? (
              <Button
                onClick={abrirFinalizar}
                variant={viagem.status === 'finalizada' ? 'outline' : 'default'}
                className={`w-full ${viagem.status === 'finalizada' ? 'border-gray-300 text-gray-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {viagem.status === 'finalizada' ? 'Corrigir KM / Combustível' : 'Finalizar Viagem'}
              </Button>
            ) : (
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-6 space-y-4">
                  {viagem.km_inicial == null && viagem.status === 'em_andamento' && (
                    <p className="text-xs text-emerald-800 bg-emerald-100 rounded-md px-3 py-2">
                      Esta viagem foi iniciada pelo GPS sem KM inicial. Informe o <strong>KM inicial</strong> e o <strong>final</strong> para entrar no relatório de KM.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="mb-1 block">KM Inicial</Label><Input type="number" className="h-11" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} placeholder="Hodômetro na saída" /></div>
                    <div><Label className="mb-1 block">KM Final</Label><Input type="number" className="h-11" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} placeholder="Hodômetro na chegada" /></div>
                    <div><Label className="mb-1 block">Combustível Inicial %</Label><Input type="number" min="0" max="100" className="h-11" value={combustivelInicial} onChange={(e) => setCombustivelInicial(e.target.value)} /></div>
                    <div><Label className="mb-1 block">Combustível Final %</Label><Input type="number" min="0" max="100" className="h-11" value={combustivelFinal} onChange={(e) => setCombustivelFinal(e.target.value)} /></div>
                  </div>
                  {kmInicial !== '' && kmFinal !== '' && Number(kmFinal) < Number(kmInicial) && (
                    <p className="text-xs text-red-600">O KM final não pode ser menor que o inicial.</p>
                  )}
                  <div><Label className="mb-1 block">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} /></div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setModoFinalizar(false)} className="flex-1">Cancelar</Button>
                    <Button
                      onClick={() => finalizarMutation.mutate()}
                      disabled={finalizarMutation.isPending || (kmInicial !== '' && kmFinal !== '' && Number(kmFinal) < Number(kmInicial))}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {finalizarMutation.isPending ? 'Salvando...' : 'Confirmar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Abastecimentos */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-gray-900 text-base"><Fuel className="w-5 h-5" /> Abastecimentos</CardTitle>
              {podeEditar && (
                <Button size="sm" onClick={() => setShowNovoAbastecimento(v => !v)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-3 h-3 mr-1" /> Novo
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {showNovoAbastecimento && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 gap-3">
                  <div><Label className="mb-1 block">Litros</Label><Input type="number" step="0.01" className="h-11" value={novoAbastecimento.litros} onChange={(e) => setNovoAbastecimento({ ...novoAbastecimento, litros: e.target.value })} /></div>
                  <div><Label className="mb-1 block">Valor/Litro (R$)</Label><Input type="number" step="0.01" className="h-11" value={novoAbastecimento.valor_litro} onChange={(e) => setNovoAbastecimento({ ...novoAbastecimento, valor_litro: e.target.value })} /></div>
                  <div><Label className="mb-1 block">Valor Total (R$)</Label><Input type="number" step="0.01" className="h-11" value={novoAbastecimento.valor_total || (num(novoAbastecimento.litros) * num(novoAbastecimento.valor_litro)).toFixed(2)} onChange={(e) => setNovoAbastecimento({ ...novoAbastecimento, valor_total: e.target.value })} /></div>
                  <div><Label className="mb-1 block">Posto</Label><Input className="h-11" value={novoAbastecimento.posto} onChange={(e) => setNovoAbastecimento({ ...novoAbastecimento, posto: e.target.value })} /></div>
                  <div className="col-span-2">
                    <Button onClick={() => adicionarAbastecimentoMutation.mutate()} disabled={adicionarAbastecimentoMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">{adicionarAbastecimentoMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                  </div>
                </div>
              )}

              {abastecimentos.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">Nenhum abastecimento registrado</p>
              ) : (
                <div className="space-y-2">
                  {abastecimentos.map(a => (
                    <div key={a.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg">
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">{num(a.litros).toFixed(2)} L · {moeda(a.valor_total)}</p>
                        <p className="text-gray-500">{[a.posto, a.data ? new Date(a.data).toLocaleDateString('pt-BR') : null].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                      {podeEditar && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deletarAbastecimentoMutation.mutate(a.id)} disabled={deletarAbastecimentoMutation.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-3 mt-3 flex items-center justify-between font-semibold text-gray-800">
                    <span>Total</span>
                    <span>{totalLitros.toFixed(2)} L · {moeda(totalAbastecimento)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
