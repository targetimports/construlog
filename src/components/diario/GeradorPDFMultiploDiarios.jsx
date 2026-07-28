import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function GeradorPDFMultiploDiarios() {
  const [openDialog, setOpenDialog] = useState(false);
  const [filtros, setFiltros] = useState({
    obraId: '',
    dataInicio: '',
    dataFim: '',
    config: {
      mostrar_clima: true,
      mostrar_mao_obra: true,
      mostrar_equipamentos: true,
      mostrar_atividades: true,
      mostrar_ocorrencias: true,
      mostrar_comentarios: true
    }
  });
  const [resultado, setResultado] = useState(null);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-pdf'],
    queryFn: () => base44.entities.Obra.list()
  });

  const gerarPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('gerarPDFMultiplosDiariosObra', filtros);
      return response.data;
    },
    onSuccess: (data) => {
      setResultado(data);
      toast.success('PDF está sendo gerado e será enviado por email');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <>
      <Button onClick={() => setOpenDialog(true)} variant="outline" className="gap-2">
        <FileText className="w-4 h-4" />
        PDF Múltiplos RDOs
      </Button>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar PDF - Múltiplos Diários</DialogTitle>
          </DialogHeader>

          {!resultado ? (
            <div className="space-y-4">
              {/* Obra */}
              <div>
                <label className="text-sm font-medium">Obra *</label>
                <select
                  value={filtros.obraId}
                  onChange={(e) => setFiltros({...filtros, obraId: e.target.value})}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">Selecione...</option>
                  {obras.map(obra => (
                    <option key={obra.id} value={obra.id}>{obra.nome}</option>
                  ))}
                </select>
              </div>

              {/* Período */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Data Início *</label>
                  <Input
                    type="date"
                    value={filtros.dataInicio}
                    onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data Fim *</label>
                  <Input
                    type="date"
                    value={filtros.dataFim}
                    onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                  />
                </div>
              </div>

              {/* Visibilidade */}
              <div>
                <p className="text-sm font-medium mb-2">Conteúdo do Relatório</p>
                <div className="space-y-2">
                  {[
                    { key: 'mostrar_clima', label: 'Condições Climáticas' },
                    { key: 'mostrar_mao_obra', label: 'Mão de Obra' },
                    { key: 'mostrar_equipamentos', label: 'Equipamentos' },
                    { key: 'mostrar_atividades', label: 'Atividades' },
                    { key: 'mostrar_ocorrencias', label: 'Ocorrências' },
                    { key: 'mostrar_comentarios', label: 'Comentários' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filtros.config[item.key]}
                        onCheckedChange={(checked) => setFiltros({
                          ...filtros,
                          config: {...filtros.config, [item.key]: checked}
                        })}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Mail className="h-4 w-4 text-blue-600" />
                <div className="ml-2">
                  <p className="text-xs text-blue-900">
                    O PDF será enviado por email em até 10 minutos. Link válido por 48 horas.
                  </p>
                </div>
              </Alert>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert className="bg-green-50 border-green-200">
                <FileText className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-green-900">PDF em processamento!</p>
                  <p className="text-xs text-green-800">
                    {resultado.total_diarios} diário(s) será(ão) incluído(s)
                  </p>
                </div>
              </Alert>
              <p className="text-sm text-gray-600">
                Você receberá um email com o link para download em breve.
              </p>
              <p className="text-xs text-gray-500">
                Link válido por: <strong>{resultado.validade_horas}h</strong>
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setOpenDialog(false);
              setResultado(null);
            }}>
              {resultado ? 'Fechar' : 'Cancelar'}
            </Button>
            {!resultado && (
              <Button
                onClick={() => gerarPDFMutation.mutate()}
                disabled={!filtros.obraId || !filtros.dataInicio || !filtros.dataFim || gerarPDFMutation.isPending}
                className="gap-2"
              >
                {gerarPDFMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Gerar PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}