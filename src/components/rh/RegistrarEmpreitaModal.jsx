import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Handshake, Info } from 'lucide-react';
import { toast } from 'sonner';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// REGISTRAR EMPREITA — porta de entrada na língua do cliente ("acordo por um valor
// fechado para levantar o bloco A"), que por baixo cria o CONTRATO DE EMPREITADA.
//
// O pagamento NÃO sai daqui: sai do "Medir" do contrato, que já trava o saldo. Ter
// dois lugares gerando conta a pagar do mesmo acordo deixaria pagar acima do
// combinado — por isso este modal termina mandando o usuário para o Medir.
export default function RegistrarEmpreitaModal({ open, onOpenChange, profissional }) {
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().split('T')[0];
  const [obraId, setObraId] = useState('');
  const [servico, setServico] = useState('');
  const [valor, setValor] = useState('');
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-empreita'],
    queryFn: () => base44.entities.Obra.list('-created_date', 500).catch(() => []),
    enabled: open,
  });

  // Empreitas que este profissional já tem — evita cadastrar a mesma duas vezes e
  // mostra o andamento de cada acordo.
  const { data: contratos = [] } = useQuery({
    queryKey: ['empreitas-do-profissional', profissional?.id],
    queryFn: () => base44.entities.Contrato.filter({ fornecedor_id: profissional.id }).catch(() => []),
    enabled: open && !!profissional?.id,
  });
  const empreitas = useMemo(
    () => (contratos || []).filter((c) => c.tipo === 'empreitada' && c.status !== 'cancelado'),
    [contratos]
  );

  const obrasOpts = useMemo(
    () => (obras || [])
      .filter((o) => !['encerrada', 'cancelada', 'concluida'].includes(String(o.status || '').toLowerCase()))
      .map((o) => ({ value: o.id, label: o.nome })),
    [obras]
  );

  const limpar = () => { setObraId(''); setServico(''); setValor(''); setInicio(hoje); setFim(''); };

  const registrar = useMutation({
    mutationFn: () => base44.functions.invoke('registrarEmpreita', {
      terceirizado_id: profissional.id,
      obra_id: obraId,
      servico,
      valor: Number(String(valor).replace(',', '.')),
      data_inicio: inicio,
      data_fim_prevista: fim || null,
    }),
    onSuccess: (res) => {
      const d = res?.data || res;
      toast.success(
        `Empreita ${d?.numero} registrada em ${d?.obra_nome} — ${fmtBRL(d?.valor)}. Para pagar, use "Medir" em Obra → Orçamento & Contratos.`,
        { duration: 9000 }
      );
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('contrato') || String(q.queryKey?.[0] || '').includes('empreita') });
      limpar();
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err?.detail?.message || err?.response?.data?.message;
      toast.error(msg || 'Erro ao registrar empreita: ' + err.message);
    },
  });

  const v = Number(String(valor).replace(',', '.')) || 0;
  const podeSalvar = obraId && v > 0 && !registrar.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) limpar(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-purple-600" />
            Registrar empreita — {profissional?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Obra *</Label>
            <ComboboxBusca
              options={obrasOpts}
              value={obraId}
              onSelect={setObraId}
              placeholder="Em qual obra é o serviço?"
              searchPlaceholder="Buscar obra..."
            />
          </div>

          <div>
            <Label className="text-xs">Serviço combinado</Label>
            <Input value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex: Levantar a alvenaria do bloco A" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Valor fechado (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fim previsto</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 p-3 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-900">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              O pagamento sai da <strong>medição</strong>: conforme o serviço anda, você mede em
              <strong> Obra → Orçamento &amp; Contratos → Medir</strong>, e cada medição aprovada vira conta a
              pagar. O sistema não deixa pagar acima do valor fechado.
            </span>
          </div>

          {empreitas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1.5">Empreitas já registradas deste profissional</p>
              <div className="space-y-1.5">
                {empreitas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded-md p-2">
                    <span className="truncate">
                      <span className="font-medium text-gray-900">{c.numero}</span>
                      <span className="text-gray-500"> · {c.titulo}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-gray-700">{fmtBRL(c.valor_total)}</span>
                      <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => registrar.mutate()} disabled={!podeSalvar} className="bg-purple-600 hover:bg-purple-700">
            {registrar.isPending ? 'Registrando...' : 'Registrar empreita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
