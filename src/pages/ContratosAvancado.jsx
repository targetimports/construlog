import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, AlertTriangle, Calendar } from 'lucide-react';
import AnalisadorContratosIA from '../components/contratos/AnalisadorContratosIA';
import MonitorContratosVencimento from '../components/contratos/MonitorContratosVencimento';
import { toast } from 'sonner';

export default function ContratosAvancado() {
  const [abaSelecionada, setAbaSelecionada] = useState('monitor');
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  const [showAnaliseModal, setShowAnaliseModal] = useState(false);

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos'],
    queryFn: () => base44.entities.Contrato.list()
  });

  const handleAnalisarContrato = (contrato) => {
    setContratoSelecionado(contrato);
    setShowAnaliseModal(true);
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Gestão Inteligente de Contratos
        </h1>
        <p className="text-gray-600 mt-1">Análise IA de cláusulas, identificação de riscos e monitoramento de prazos</p>
      </div>

      <Tabs value={abaSelecionada} onValueChange={setAbaSelecionada}>
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Monitorar Vencimentos
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Análise de Risco
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Todos os Contratos
          </TabsTrigger>
        </TabsList>

        {/* Monitor de Vencimentos */}
        <TabsContent value="monitor" className="space-y-4">
          <MonitorContratosVencimento contratos={contratos} />
        </TabsContent>

        {/* Análise de Risco */}
        <TabsContent value="analise" className="space-y-4">
          {contratoSelecionado && showAnaliseModal ? (
            <>
              <Card className="bg-blue-50">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{contratoSelecionado.numero}</p>
                    <p className="text-sm text-gray-600">{contratoSelecionado.fornecedor_cliente}</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowAnaliseModal(false)}>
                    Voltar
                  </Button>
                </CardContent>
              </Card>
              <AnalisadorContratosIA
                contrato={contratoSelecionado}
                onAnaliseCompleta={() => toast.success('Análise salva!')}
              />
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">Selecione um contrato para análise detalhada</p>
              <div className="grid gap-3">
                {contratos.map(contrato => (
                  <Card key={contrato.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">{contrato.numero || contrato.id}</p>
                        <p className="text-sm text-gray-600">{contrato.fornecedor_cliente || '-'}</p>
                      </div>
                      <Button onClick={() => handleAnalisarContrato(contrato)} size="sm">
                        Analisar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Lista de Contratos */}
        <TabsContent value="lista" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">Total de {contratos.length} contratos</p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Contrato
            </Button>
          </div>

          <div className="space-y-3">
            {contratos.map(contrato => (
              <Card key={contrato.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{contrato.numero || 'Sem número'}</p>
                      <p className="text-sm text-gray-600 mt-1">Fornecedor/Cliente: {contrato.fornecedor_cliente || '-'}</p>
                      <p className="text-sm text-gray-600">Status: <span className="font-semibold">{contrato.status || 'Ativo'}</span></p>
                      {contrato.data_vencimento && (
                        <p className="text-sm text-gray-600">Vencimento: {new Date(contrato.data_vencimento).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalisarContrato(contrato)}
                      >
                        Analisar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {contratos.length === 0 && (
            <Card className="text-center p-8 text-gray-600">
              Nenhum contrato cadastrado
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}