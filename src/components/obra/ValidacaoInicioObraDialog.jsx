import React from 'react';
import { AlertTriangle, AlertCircle, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Dialog da Regra-Mãe de ativação da obra (status → Em Andamento).
 * Renderiza a lista genérica de checagens vinda de `validarInicioObra`:
 *   validacao = { pode_ativar, bloqueado, modoRigoroso, checks:[{chave,label,ok,detalhe}], alertas, fluxo }
 *
 * Fallback: se vier o formato antigo (temRequisicao/temEstoque), monta os checks.
 */
export default function ValidacaoInicioObraDialog({ open, onClose, onConfirm, validacao, loading = false }) {
  if (!validacao) return null;

  const checks = Array.isArray(validacao.checks) && validacao.checks.length > 0
    ? validacao.checks
    : [
        { chave: 'requisicao', label: 'Requisição de Material', ok: !!validacao.temRequisicao, detalhe: validacao.temRequisicao ? 'Existe requisição' : 'Nenhuma requisição' },
        { chave: 'estoque', label: 'Estoque da Obra', ok: !!validacao.temEstoque, detalhe: validacao.temEstoque ? 'Material disponível' : 'Estoque vazio' },
      ];

  const bloqueado = !!validacao.bloqueado;
  const tudoOk = validacao.pode_ativar ?? checks.every((c) => c.ok);
  const modoRigoroso = validacao.modoRigoroso !== false;
  const fluxo = validacao.fluxo;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            {bloqueado ? (
              <><AlertTriangle className="w-5 h-5 text-red-500" /> Não é possível ativar a obra</>
            ) : tudoOk ? (
              <><Check className="w-5 h-5 text-emerald-500" /> Obra pronta para ativar</>
            ) : (
              <><AlertCircle className="w-5 h-5 text-amber-500" /> Atenção ao ativar a obra</>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm pt-1">
            {bloqueado
              ? 'A Regra-Mãe exige orçamento, custo previsto, plano de recebimento e fluxo de caixa positivo. Resolva as pendências abaixo para ativar.'
              : tudoOk
                ? 'Todos os requisitos financeiros foram atendidos.'
                : 'Há pendências. Você pode continuar (modo flexível), mas recomendamos resolvê-las.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-4">
          {checks.map((c) => (
            <div
              key={c.chave}
              className={`flex items-center gap-3 p-3 rounded-lg border ${c.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
            >
              {c.ok
                ? <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${c.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{c.label}</p>
                <p className={`text-xs ${c.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{c.detalhe}</p>
              </div>
              <Badge className={c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                {c.ok ? 'OK' : 'Pendente'}
              </Badge>
            </div>
          ))}

          {fluxo && (
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              <span>Recebimentos previstos: <strong>{(fluxo.recebimentos_previstos || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
              <span>Custos previstos: <strong>{(fluxo.custos_previstos || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-600">Modo de Validação</span>
            <Badge variant="outline" className={modoRigoroso ? 'border-red-300 text-red-600' : 'border-blue-300 text-blue-600'}>
              {modoRigoroso ? 'Rigoroso (trava)' : 'Flexível'}
            </Badge>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {bloqueado ? 'Fechar' : 'Cancelar'}
          </Button>
          {!bloqueado && (
            <Button
              onClick={onConfirm}
              disabled={loading}
              className={tudoOk ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {loading ? 'Salvando...' : tudoOk ? 'Confirmar Ativação' : 'Continuar mesmo assim'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
