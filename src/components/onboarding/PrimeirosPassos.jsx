import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const passos = [
  {
    id: 'obra',
    titulo: '1. Cadastre sua Primeira Obra',
    descricao: 'Clique em "Obras" no menu → Botão "+" → Preencha: Nome da Obra, Cliente, Endereço e Status (deixe como "Orçamento")',
    dica: 'Dica: Use um nome claro como "Obra - Rua XYZ" para facilitar a identificação',
    page: 'ObraForm',
    checkFn: async () => {
      const obras = await base44.entities.Obra.list();
      return obras.length > 0;
    }
  },
  {
    id: 'orcamento',
    titulo: '2. Crie o Orçamento da Obra',
    descricao: 'Vá em "Orçamentos" → Botão "+" → Selecione a Obra → Adicione itens (materiais e serviços) com quantidades e valores',
    dica: 'Dica: Você pode importar itens da tabela SINAPI ou digitar manualmente',
    page: 'OrcamentoForm',
    checkFn: async () => {
      const orcamentos = await base44.entities.Orcamento.list();
      return orcamentos.length > 0;
    }
  },
  {
    id: 'aprovar_orcamento',
    titulo: '3. Aprove o Orçamento',
    descricao: 'Abra o orçamento criado → Clique em "Aprovar Orçamento" → Isso libera a obra para iniciar',
    dica: 'Importante: Só orçamentos aprovados geram medições e controle financeiro',
    page: 'Orcamentos',
    checkFn: async () => {
      const orcamentos = await base44.entities.Orcamento.list();
      return orcamentos.some(o => o.status === 'aprovado');
    }
  },
  {
    id: 'iniciar_obra',
    titulo: '4. Inicie a Obra',
    descricao: 'Vá em "Obras" → Abra a obra → Mude o Status para "Em Andamento" → Salve',
    dica: 'Agora você pode fazer medições e acompanhar o progresso!',
    page: 'Obras',
    checkFn: async () => {
      const obras = await base44.entities.Obra.list();
      return obras.some(o => o.status === 'em_andamento');
    }
  },
  {
    id: 'conta_bancaria',
    titulo: '5. Configure o Financeiro',
    descricao: 'Vá em "Financeiro" → "Contas Bancárias" → Adicione sua conta do banco → Defina saldo inicial',
    dica: 'Isso permite controlar entradas, saídas e fluxo de caixa',
    page: 'Financeiro',
    checkFn: async () => {
      const contas = await base44.entities.ContaBancaria.list();
      return contas.length > 0;
    }
  },
  {
    id: 'primeiro_lancamento',
    titulo: '6. Faça seu Primeiro Lançamento',
    descricao: 'Em "Financeiro" → "Novo Lançamento" → Escolha tipo (Entrada/Saída), valor, data e descrição',
    dica: 'Registre todas movimentações: pagamentos, recebimentos, compras',
    page: 'Financeiro',
    checkFn: async () => {
      const contas = await base44.entities.ContaFinanceira.list();
      return contas.length > 0;
    }
  },
  {
    id: 'medicao',
    titulo: '7. Registre a Primeira Medição',
    descricao: 'Vá em "Medições" → "Nova Medição" → Selecione a obra → Informe o que foi executado no período',
    dica: 'As medições validam o progresso físico e financeiro da obra',
    page: 'Medicoes',
    checkFn: async () => {
      const medicoes = await base44.entities.Medicao.list();
      return medicoes.length > 0;
    }
  },
  {
    id: 'estoque',
    titulo: '8. Organize o Estoque (Opcional)',
    descricao: 'Vá em "Estoque" → Cadastre materiais → Registre entradas e saídas → Vincule às obras',
    dica: 'Controle exato de materiais evita desperdícios e compras desnecessárias',
    page: 'Estoque',
    checkFn: async () => {
      const materiais = await base44.entities.Material.list();
      return materiais.length > 0;
    }
  },
  {
    id: 'compras',
    titulo: '9. Gerencie Compras',
    descricao: 'Vá em "Compras" → Crie requisições → Converta em ordens de compra → Registre recebimentos',
    dica: 'Isso integra compras com estoque e financeiro automaticamente',
    page: 'Compras',
    checkFn: async () => {
      const compras = await base44.entities.OrdemCompra.list();
      return compras.length > 0;
    }
  },
  {
    id: 'gestao',
    titulo: '10. Acompanhe a Gestão',
    descricao: 'Acesse "Gestão de Obras" para ver: curva S, comparativo orçado x realizado, prazos, custos',
    dica: 'Parabéns! Você dominou o essencial do sistema!',
    page: 'GestaoObras',
    checkFn: async () => {
      return false;
    }
  }
];

export default function PrimeirosPassos({ open, onOpenChange }) {
  const [passosCompletos, setPassosCompletos] = useState({});
  const [ocultado, setOcultado] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem('primeiros_passos_ocultado');
    if (hidden === 'true') {
      setOcultado(true);
    }
  }, []);

  useEffect(() => {
    if (open && !ocultado) {
      verificarPassos();
    }
  }, [open, ocultado]);

  const verificarPassos = async () => {
    const status = {};
    for (const passo of passos) {
      try {
        status[passo.id] = await passo.checkFn();
      } catch (error) {
        status[passo.id] = false;
      }
    }
    setPassosCompletos(status);
  };

  const handleOcultar = () => {
    localStorage.setItem('primeiros_passos_ocultado', 'true');
    setOcultado(true);
    onOpenChange(false);
  };

  const totalPassos = passos.length;
  const passosRealizados = Object.values(passosCompletos).filter(Boolean).length;
  const progresso = (passosRealizados / totalPassos) * 100;

  if (ocultado) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* Header Azul */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold leading-tight mb-1">
                Comece aqui sua escalada rumo à Nova Gestão de Obras
              </h2>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/90">Progresso</span>
              <span className="font-semibold">{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-2 bg-white/20" />
          </div>
        </div>

        {/* Passos */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {passos.map((passo, index) => {
            const completo = passosCompletos[passo.id];
            const proximoPasso = index === 0 || passosCompletos[passos[index - 1].id];
            
            return (
              <button
                key={passo.id}
                onClick={() => {
                  if (proximoPasso) {
                    window.location.href = createPageUrl(passo.page);
                    onOpenChange(false);
                  }
                }}
                disabled={!proximoPasso}
                className="w-full flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="relative flex-shrink-0 pt-1">
                  {completo ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  )}
                  {index < passos.length - 1 && (
                    <div className="absolute left-1/2 top-8 w-px h-12 bg-gray-200 -translate-x-1/2" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {passo.titulo}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {passo.descricao}
                  </p>
                  {passo.dica && (
                    <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                      {passo.dica}
                    </p>
                  )}
                </div>

                {proximoPasso && !completo && (
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={handleOcultar}
            className="w-full"
          >
            Ocultar Primeiros Passos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}