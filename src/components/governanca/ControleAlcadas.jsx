import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Users, Clock, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tipoConfig = {
  compra: { label: 'Compra', icon: '' },
  pagamento: { label: 'Pagamento', icon: '' },
  contrato: { label: 'Contrato', icon: '' },
  orcamento: { label: 'Orçamento', icon: '' },
  medicao: { label: 'Medição', icon: '' },
  requisicao: { label: 'Requisição', icon: '' },
  obra: { label: 'Obra', icon: '' }
};

export default function ControleAlcadas({ alcadas }) {
  const alcadasAtivas = alcadas.filter(a => a.ativo);
  const alcadasInativas = alcadas.filter(a => !a.ativo);

  // Agrupar por tipo
  const porTipo = alcadasAtivas.reduce((acc, alc) => {
    if (!acc[alc.tipo]) acc[alc.tipo] = [];
    acc[alc.tipo].push(alc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              Alçadas de Aprovação
            </CardTitle>
            <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">
              <Plus className="w-4 h-4 mr-2" />
              Nova Alçada
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-400 text-2xl font-bold">{alcadasAtivas.length}</p>
              <p className="text-gray-400 text-sm">Alçadas Ativas</p>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-purple-400 text-2xl font-bold">{Object.keys(porTipo).length}</p>
              <p className="text-gray-400 text-sm">Tipos Controlados</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-xl">
              <p className="text-gray-400 text-2xl font-bold">{alcadasInativas.length}</p>
              <p className="text-gray-500 text-sm">Inativas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.entries(porTipo).map(([tipo, alcadasTipo]) => {
        const config = tipoConfig[tipo];
        const alcadasOrdenadas = [...alcadasTipo].sort((a, b) => a.nivel - b.nivel);

        return (
          <Card key={tipo} className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span className="text-2xl">{config?.icon}</span>
                {config?.label}
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                  {alcadasTipo.length} níveis
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alcadasOrdenadas.map(alcada => (
                <div key={alcada.id} className="p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                          Nível {alcada.nivel}
                        </Badge>
                        <h3 className="text-white font-semibold">{alcada.titulo}</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Valor Mínimo:</span>
                          <span className="text-white ml-2">
                            {alcada.valor_minimo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Valor Máximo:</span>
                          <span className="text-white ml-2">
                            {alcada.valor_maximo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '∞'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-400">{alcada.aprovadores?.length || 0} aprovador(es)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-gray-400">
                            {alcada.quantidade_aprovacoes_necessarias || 1} aprovação necessária
                          </span>
                        </div>
                        {alcada.tempo_maximo_dias && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span className="text-gray-400">{alcada.tempo_maximo_dias} dias</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {alcada.aprovadores && alcada.aprovadores.length > 0 && (
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-gray-400 text-xs mb-2">Aprovadores:</p>
                      <div className="flex flex-wrap gap-2">
                        {alcada.aprovadores.map((email, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs text-gray-300">
                            {email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {alcadasAtivas.length === 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <Lock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Nenhuma alçada cadastrada</h3>
            <p className="text-gray-500 mb-6">Configure as alçadas de aprovação para controlar operações</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Alçada
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}