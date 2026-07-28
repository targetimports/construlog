import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import ConcertadorContexto from '@/components/concertador/ConcertadorContexto';
import ConcertadorDiagnostico from '@/components/concertador/ConcertadorDiagnostico';
import ConcertadorChecklist from '@/components/concertador/ConcertadorChecklist';
import ConcertadorRelatorio from '@/components/concertador/ConcertadorRelatorio';
import ConcertadorPrompt from '@/components/concertador/ConcertadorPrompt';

export default function Concertador() {
  const [contexto, setContexto] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [activeTab, setActiveTab] = useState('contexto');

  const progresso = [
    contexto ? 1 : 0,
    diagnostico ? 1 : 0,
    checklist ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="w-full h-full p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-900">CONCERTADOR</h1>
          </div>
          <p className="text-gray-600">Auditoria completa do projeto + gerador de prompts para correções</p>
          
          {/* Progresso */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="flex items-center gap-2">
                <div className={`flex-1 h-2 rounded-full ${contexto ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className={`flex-1 h-2 rounded-full ${diagnostico ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className={`flex-1 h-2 rounded-full ${checklist ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
              <p className="text-sm text-gray-500 mt-2">{progresso}/3 etapas completas</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-5">
            <TabsTrigger value="contexto" className="flex items-center gap-2">
              <span className="hidden sm:inline">Contexto</span>
            </TabsTrigger>
            <TabsTrigger value="diagnostico" className="flex items-center gap-2">
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <span className="hidden sm:inline">Checklist</span>
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="flex items-center gap-2">
              <span className="hidden sm:inline">Relatório</span>
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <span className="hidden sm:inline">Gerar Prompt</span>
            </TabsTrigger>
          </TabsList>

          {/* Contexto */}
          <TabsContent value="contexto">
            <ConcertadorContexto 
              onSave={(data) => {
                setContexto(data);
                setActiveTab('diagnostico');
              }}
              initialData={contexto}
            />
          </TabsContent>

          {/* Diagnóstico */}
          <TabsContent value="diagnostico">
            {!contexto ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-900">Complete a coleta de contexto primeiro</p>
                </CardContent>
              </Card>
            ) : (
              <ConcertadorDiagnostico 
                contexto={contexto}
                onSave={(data) => {
                  setDiagnostico(data);
                  setActiveTab('checklist');
                }}
                initialData={diagnostico}
              />
            )}
          </TabsContent>

          {/* Checklist */}
          <TabsContent value="checklist">
            {!diagnostico ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-900">Complete o diagnóstico primeiro</p>
                </CardContent>
              </Card>
            ) : (
              <ConcertadorChecklist 
                onSave={(data) => {
                  setChecklist(data);
                  setActiveTab('relatorio');
                }}
                initialData={checklist}
              />
            )}
          </TabsContent>

          {/* Relatório */}
          <TabsContent value="relatorio">
            {!checklist ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-900">Complete o checklist primeiro</p>
                </CardContent>
              </Card>
            ) : (
              <ConcertadorRelatorio 
                contexto={contexto}
                diagnostico={diagnostico}
                checklist={checklist}
              />
            )}
          </TabsContent>

          {/* Gerar Prompt */}
          <TabsContent value="prompt">
            {!checklist ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-900">Complete todas as etapas primeiro</p>
                </CardContent>
              </Card>
            ) : (
              <ConcertadorPrompt 
                contexto={contexto}
                diagnostico={diagnostico}
                checklist={checklist}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}