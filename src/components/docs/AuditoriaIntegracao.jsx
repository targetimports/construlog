import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

/**
 * AUDITORIA DE INTEGRAÇÃO - GERMANOS CONSTRULOG
 * Documento técnico de correções aplicadas
 */

export default function AuditoriaIntegracao() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Auditoria de Integração</h1>
        <p className="text-gray-600 mt-2">Mapeamento completo de entidades e fluxos do sistema</p>
      </div>

      {/* Mapa de Interligações */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Interligações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Obra */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">OBRA (Entidade: Obra)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Dashboard, Obras, ObraDetalhes, GestaoObrasAvancada, Compras, Orcamentos</p>
              <p><strong>Escreve:</strong> ObraForm</p>
              <p><strong>Campos críticos:</strong> id, nome, cliente, status, valor_contrato, empresa_id</p>
              <p className="text-green-600">Padronizada e funcionando</p>
            </div>
          </div>

          {/* Orçamento */}
          <div className="border-l-4 border-emerald-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">ORÇAMENTO (Entidade: Orcamento)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Orcamentos, OrcamentoDetalhes, DashboardObraIntegrado</p>
              <p><strong>Escreve:</strong> OrcamentoForm</p>
              <p><strong>Itens:</strong> ItemOrcamento (array dentro ou tabela separada)</p>
              <p className="text-green-600">Unificado para usar Orcamento (não OrcamentoObra)</p>
            </div>
          </div>

          {/* Compras */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">COMPRAS (Entidade: RequisicaoCompra)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Compras, Solicitacoes, SolicitacaoDetalhes, ObraDetalhes</p>
              <p><strong>Escreve:</strong> ComprasForm, SolicitacaoForm</p>
              <p><strong>Campos padronizados:</strong></p>
              <ul className="ml-6 list-disc">
                <li>status (único): aguardando, em_cotacao, aprovada, em_compra, recebida, recusada</li>
                <li>itens[] com quantidade_solicitada, valor_estimado</li>
                <li>descricao_resumo, valor_total_estimado, qtd_itens</li>
              </ul>
              <p className="text-green-600">Padronizada</p>
            </div>
          </div>

          {/* Ordem de Compra */}
          <div className="border-l-4 border-amber-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">ORDEM DE COMPRA (Entidade: OrdemCompra)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Compras (aba Ordens), ObraDetalhes, CompraDetalhes</p>
              <p><strong>Escreve:</strong> aprovarRequisicao function (automático)</p>
              <p><strong>Campos padronizados:</strong></p>
              <ul className="ml-6 list-disc">
                <li>numero, obra_id, fornecedor_nome, valor_total</li>
                <li>itens[] com descricao, quantidade, valor_unitario</li>
                <li>status: emitida, confirmada, em_transito, recebida</li>
              </ul>
              <p className="text-green-600">Criada automaticamente na aprovação</p>
            </div>
          </div>

          {/* Recebimento */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">RECEBIMENTO (Entidade: RecebimentoMaterial)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Compras (aba Recebimentos), ObraDetalhes</p>
              <p><strong>Escreve:</strong> RecebimentoForm</p>
              <p><strong>Integração:</strong></p>
              <ul className="ml-6 list-disc">
                <li>Vincula por material_id (não por nome)</li>
                <li>Atualiza Material.estoque_atual</li>
                <li>Cria MovimentacaoEstoque (tipo: entrada)</li>
                <li>Cria ContaFinanceira (tipo: pagar) se valor_nota informado</li>
              </ul>
              <p className="text-green-600">Integrado com Estoque e Financeiro</p>
            </div>
          </div>

          {/* Financeiro */}
          <div className="border-l-4 border-indigo-500 pl-4">
            <h3 className="font-bold text-gray-900 mb-2">FINANCEIRO (Entidade: ContaFinanceira)</h3>
            <div className="text-sm space-y-1">
              <p><strong>Lê:</strong> Financeiro, FinanceiroAvancado, ObraDetalhes</p>
              <p><strong>Escreve:</strong> RecebimentoForm (automático), function gerarContaFinanceiraAutomatica</p>
              <p><strong>Gatilhos automáticos:</strong></p>
              <ul className="ml-6 list-disc">
                <li>Recebimento c/ NF → Conta a Pagar (categoria: material)</li>
                <li>Medição aprovada → Conta a Receber (categoria: medicao)</li>
              </ul>
              <p className="text-green-600">Integração automática implementada</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist de Correções */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist de Correções Aplicadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.1 - Entidades Unificadas</p>
                <p className="text-sm text-gray-600">RequisicaoCompra com status único, campos-resumo e itens[]</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.2 - Aprovação Corrigida</p>
                <p className="text-sm text-gray-600">aprovarRequisicao não cancela mais, aceita aprovado:true/false</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.3 - Ordem de Compra Automática</p>
                <p className="text-sm text-gray-600">OC gerada automaticamente ao aprovar requisição</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.4 - Links Corrigidos</p>
                <p className="text-sm text-gray-600">LinkModulos atualizado, páginas placeholder criadas</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.5 - RecebimentoForm Padronizado</p>
                <p className="text-sm text-gray-600">Usa material_id, atualiza estoque, gera movimentação e conta financeira</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.6 - ObraDetalhes Integrado</p>
                <p className="text-sm text-gray-600">Aba Compras mostra requisições, ordens e recebimentos da obra</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.7 - Sidebar Responsiva</p>
                <p className="text-sm text-gray-600">Layout com recuo dinâmico 84px/256px conforme estado</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.8 - Orçamentos Unificados</p>
                <p className="text-sm text-gray-600">Orcamentos.jsx usa entidade Orcamento (não OrcamentoObra)</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">P0.9 - Financeiro Automático</p>
                <p className="text-sm text-gray-600">ContaFinanceira gerada ao receber material com NF</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fluxo Integrado */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo Integrado Completo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">OBRA criada</p>
                <p className="text-gray-600">Página: ObraForm → Lista: Obras</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">2</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">ORÇAMENTO vinculado</p>
                <p className="text-gray-600">Página: OrcamentoForm → Vínculo: orcamento.obra_id</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">3</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">REQUISIÇÃO criada</p>
                <p className="text-gray-600">Página: ComprasForm → Campos: obra_id, itens[], valor_total_estimado</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">4</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">APROVAÇÃO</p>
                <p className="text-gray-600">Function: aprovarRequisicao → Status: aprovada → Gera OC automaticamente</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">5</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">ORDEM DE COMPRA gerada</p>
                <p className="text-gray-600">Automático → Campos: numero, obra_id, fornecedor_nome, valor_total, itens[]</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold">6</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">RECEBIMENTO registrado</p>
                <p className="text-gray-600">Página: RecebimentoForm → Vínculo: material_id (não nome)</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold">7</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">ESTOQUE atualizado</p>
                <p className="text-gray-600">Automático → Material.estoque_atual + MovimentacaoEstoque (tipo: entrada)</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">8</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">FINANCEIRO atualizado</p>
                <p className="text-gray-600">Automático → ContaFinanceira (tipo: pagar) se valor_nota informado</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status das Correções */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Correções por Prioridade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* P0 */}
            <div>
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                P0 - CRÍTICO (100% Concluído)
              </h4>
              <div className="ml-7 space-y-2 text-sm">
                <p className="text-green-600">RequisicaoCompra unificada</p>
                <p className="text-green-600">OrdemCompra com itens[]</p>
                <p className="text-green-600">aprovarRequisicao corrigido</p>
                <p className="text-green-600">Orcamento unificado</p>
                <p className="text-green-600">Links quebrados corrigidos</p>
                <p className="text-green-600">RecebimentoForm usa material_id</p>
                <p className="text-green-600">ObraDetalhes mostra compras</p>
                <p className="text-green-600">Sidebar responsiva</p>
              </div>
            </div>

            {/* P1 */}
            <div>
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                P1 - ALTA (Próximos Passos)
              </h4>
              <div className="ml-7 space-y-2 text-sm">
                <p className="text-amber-600">ItemOrcamento vs OrcamentoItem - unificar escolhendo um</p>
                <p className="text-amber-600">Multi-empresa - filtrar por empresaId em todas as listagens</p>
                <p className="text-amber-600">Medição → ContaFinanceira automática (a receber)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Próximas Ações */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Próximas Ações Recomendadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <p>1. <strong>Testar fluxo completo:</strong> Obra → Orçamento → Requisição → Aprovação → OC → Recebimento</p>
          <p>2. <strong>Configurar multi-empresa:</strong> Adicionar filtro por empresaId nas queries principais</p>
          <p>3. <strong>Automatizar medição:</strong> Criar trigger para gerar ContaFinanceira ao aprovar medição</p>
          <p>4. <strong>Documentação:</strong> Criar guia de uso do sistema para usuários finais</p>
        </CardContent>
      </Card>
    </div>
  );
}