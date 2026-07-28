import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowRight, Package, Zap, Target } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function ResumoSistema() {
  const funcionalidades = [
    {
      categoria: 'Gerenciamento de Obras',
      items: [
        { nome: 'Controle de Acesso por Obra', page: 'ControleAcessoObras', status: 'Implementado' },
        { nome: 'Gerenciar Arquivos', page: 'GerenciarArquivos', status: 'Implementado' },
        { nome: 'Medições Vinculadas ao Orçamento OrçaFascio', page: 'MedicaoComOrcamento', status: 'Implementado' },
        { nome: 'Regras de Medição', page: 'RegrasMedicao', status: 'Implementado' },
        { nome: 'Avanço por Sub-itens', page: 'ExecutionDashboard', status: 'Implementado' },
        { nome: 'Uso de Materiais', page: 'UsoMateriaisObra', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Financeiro & Impostos',
      items: [
        { nome: 'Financeiro Vinculado com Medições', page: 'Financeiro', status: 'Implementado' },
        { nome: 'Impostos Vinculados ao Financeiro', page: 'FinanceiroEstrategico', status: 'Implementado' },
        { nome: 'Contas a Pagar/Receber', page: 'Financeiro', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Ativos & Equipamentos',
      items: [
        { nome: 'Controle de Horas - Retroescavadeira', page: 'ControleHorasAtivos', status: 'Implementado' },
        { nome: 'Controle de Horas - Patrol', page: 'ControleHorasAtivos', status: 'Implementado' },
        { nome: 'Gestão de Ativos', page: 'Ativos', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Relatórios & BI',
      items: [
        { nome: 'Relatórios com Prazo Definido', page: 'RelatoriosAgendados', status: 'Implementado' },
        { nome: 'Business Intelligence', page: 'BI', status: 'Implementado' },
        { nome: 'IA Preditiva', page: 'IAPreditiva', status: 'Implementado' },
        { nome: 'Ranking Margens por Obra', page: 'RankingMargensObra', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Integração OrçaFascio',
      items: [
        { nome: 'Importar da API OrçaFascio', page: 'ImportarOrcaFacil', status: 'Implementado' },
        { nome: 'Sincronização Automática', page: 'ImportarOrcaFacil', status: 'Implementado' },
        { nome: 'Composições Completas', page: 'ImportarOrcaFacil', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Recursos Humanos',
      items: [
        { nome: 'Profissionais Terceirizados', page: 'ProfissionaisTerceirizados', status: 'Implementado' },
        { nome: 'Gestão de Mão de Obra', page: 'GestaoMaoDeObra', status: 'Implementado' },
        { nome: 'Colaboradores', page: 'Colaboradores', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Bases de Referência',
      items: [
        { nome: 'Tabela SINAPI', page: 'TabelaSINAPI', status: 'Implementado' },
        { nome: 'Tabela SILI', page: 'TabelaSILI', status: 'Implementado' }
      ]
    },
    {
      categoria: 'Compras & Fornecedores',
      items: [
        { nome: 'Melhor Fornecedor', page: 'ComparativoFornecedores', status: 'Implementado' },
        { nome: 'Preços x Fornecedor', page: 'ComparativoFornecedores', status: 'Implementado' },
        { nome: 'Automação Orçamento IA', page: 'AutomacaoOrcamento', status: 'Implementado' }
      ]
    }
  ];

  const totalItems = funcionalidades.reduce((acc, cat) => acc + cat.items.length, 0);
  const implementados = funcionalidades.reduce((acc, cat) => 
    acc + cat.items.filter(i => i.status === 'Implementado').length, 0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo do Sistema"
        subtitle="Visão completa de todas as funcionalidades implementadas"
      />

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-green-200 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Total Implementado</p>
              <p className="text-3xl font-bold text-green-900">{implementados}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-blue-200 flex items-center justify-center">
              <Package className="w-7 h-7 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Categorias</p>
              <p className="text-3xl font-bold text-blue-900">{funcionalidades.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-300 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-purple-200 flex items-center justify-center">
              <Target className="w-7 h-7 text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-700">Progresso</p>
              <p className="text-3xl font-bold text-purple-900">{Math.round((implementados/totalItems)*100)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista por Categoria */}
      <div className="space-y-5">
        {funcionalidades.map((categoria, idx) => (
          <div key={idx} className="bg-white border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{categoria.categoria}</h3>
                <Badge className="bg-green-600 text-white">
                  {categoria.items.filter(i => i.status === 'Implementado').length}/{categoria.items.length}
                </Badge>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {categoria.items.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  to={createPageUrl(item.page)}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-900 font-medium">{item.nome}</span>
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full ml-auto md:ml-2">
                      {item.status}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all ml-2 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resumo Final */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-center border border-blue-800">
        <Zap className="w-14 h-14 text-yellow-300 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-3">
          Sistema Completo Implementado
        </h3>
        <p className="text-blue-100 text-base">
          Todas as {implementados} funcionalidades solicitadas foram desenvolvidas e estão prontas para uso.
        </p>
      </div>
    </div>
  );
}