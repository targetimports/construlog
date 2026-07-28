import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ConcertadorRelatorio({ contexto, diagnostico, checklist }) {
  const bugs = checklist.items.filter(i => i.status === 'bug').sort((a, b) => {
    const priorityOrder = { bug: 0, warning: 1, pending: 2 };
    return (priorityOrder[a.status] || 3) - (priorityOrder[b.status] || 3);
  });

  const pendentes = checklist.items.filter(i => i.status === 'pending');
  const avisos = checklist.items.filter(i => i.status === 'warning');

  const problemasList = contexto.problemasPrincipais
    ?.split('\n')
    .filter(p => p.trim())
    .slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Resumo Executivo */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Resumo Executivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Aplicação</p>
            <p className="text-xl font-bold text-blue-900">{contexto.nomeApp || 'Sem nome'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Status da Auditoria</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="font-bold text-lg text-green-600">{checklist.items.filter(i => i.status === 'ok').length}</p>
                <p className="text-xs text-gray-700">OK</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-yellow-600">{avisos.length}</p>
                <p className="text-xs text-gray-700">Avisos</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-red-600">{bugs.length}</p>
                <p className="text-xs text-gray-700">Bugs</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-gray-600">{pendentes.length}</p>
                <p className="text-xs text-gray-700">Pendentes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Bugs por Prioridade */}
      {bugs.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Bugs Encontrados (Prioridade Alta)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bugs.map((bug, idx) => (
                <div key={bug.id} className="border-l-4 border-red-500 pl-4 py-2">
                  <p className="font-medium text-gray-900">{idx + 1}. {bug.nome}</p>
                  {bug.obs && (
                    <p className="text-sm text-gray-600 mt-1">{bug.obs}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avisos & Pendências */}
      {avisos.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="w-5 h-5" />
              Avisos (Melhorias Recomendadas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {avisos.map((aviso) => (
                <div key={aviso.id} className="border-l-4 border-yellow-500 pl-4 py-2">
                  <p className="font-medium text-gray-900">{aviso.nome}</p>
                  {aviso.obs && (
                    <p className="text-sm text-gray-600 mt-1">{aviso.obs}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* O que Falta */}
      {pendentes.length > 0 && (
        <Card className="border-gray-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Itens Pendentes de Verificação</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendentes.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-1">•</span>
                  <div>
                    <p className="font-medium text-gray-900">{item.nome}</p>
                    {item.obs && (
                      <p className="text-sm text-gray-600">{item.obs}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnóstico */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle>Resultado do Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {diagnostico.env && (
              <div className="border rounded p-3">
                <p className="font-medium text-sm">.env</p>
                <p className="text-xs text-gray-600 mt-1">{diagnostico.env.mensagem}</p>
              </div>
            )}
            {diagnostico.dependencias && (
              <div className="border rounded p-3">
                <p className="font-medium text-sm">Dependências</p>
                <p className="text-xs text-gray-600 mt-1">{diagnostico.dependencias.mensagem}</p>
              </div>
            )}
            {diagnostico.lint && (
              <div className="border rounded p-3">
                <p className="font-medium text-sm">Lint</p>
                <p className="text-xs text-gray-600 mt-1">{diagnostico.lint.mensagem}</p>
              </div>
            )}
            {diagnostico.smokeTest && (
              <div className="border rounded p-3">
                <p className="font-medium text-sm">Health Check</p>
                <p className="text-xs text-gray-600 mt-1">{diagnostico.smokeTest.mensagem}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Próximos Passos */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            Próximos Passos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside text-sm text-gray-700">
            <li>Revisar todos os bugs encontrados acima</li>
            <li>Corrigir avisos de qualidade de código</li>
            <li>Completar verificações pendentes</li>
            <li>Gerar prompt para assistente de IA usando a aba "Gerar Prompt"</li>
            <li>Executar testes completos após as correções</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}