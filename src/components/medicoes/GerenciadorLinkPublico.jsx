import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, Copy, Share2, Settings, Clock, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function GerenciadorLinkPublico({ medicaoId }) {
  const [open, setOpen] = useState(false);
  const [linkGerado, setLinkGerado] = useState(null);
  const [config, setConfig] = useState({
    visao: 'completa',
    mostrar_etapas: true,
    mostrar_comentarios: true,
    mostrar_anexos: true,
    mostrar_assinaturas: false,
    mostrar_dados_empresa: false
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('gerarLinkPublicoMedicao', {
        medicaoId,
        config
      });
      return res.data;
    },
    onSuccess: (data) => {
      setLinkGerado(data);
      toast.success('Link gerado com sucesso!');
    }
  });

  const copiarLink = () => {
    navigator.clipboard.writeText(linkGerado.link_publico);
    toast.success('Link copiado para a área de transferência');
  };

  const compartilharWhatsApp = () => {
    const mensagem = encodeURIComponent(`Confira a medição da obra: ${linkGerado.link_publico}`);
    window.open(`https://wa.me/?text=${mensagem}`);
  };

  return (
    <>
      {/* Botão de abertura */}
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Link className="w-4 h-4" /> Link Público
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Link Público</DialogTitle>
          </DialogHeader>

          {!linkGerado ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Configure o que será visível no relatório público para seu cliente
              </p>

              <div className="space-y-3 border-y py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.mostrar_etapas}
                    onCheckedChange={(v) => setConfig({...config, mostrar_etapas: v})}
                  />
                  <Label className="text-sm font-medium">Mostrar Etapas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.mostrar_comentarios}
                    onCheckedChange={(v) => setConfig({...config, mostrar_comentarios: v})}
                  />
                  <Label className="text-sm font-medium">Mostrar Comentários</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.mostrar_anexos}
                    onCheckedChange={(v) => setConfig({...config, mostrar_anexos: v})}
                  />
                  <Label className="text-sm font-medium">Mostrar Anexos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.mostrar_assinaturas}
                    onCheckedChange={(v) => setConfig({...config, mostrar_assinaturas: v})}
                  />
                  <Label className="text-sm font-medium">Mostrar Assinaturas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.mostrar_dados_empresa}
                    onCheckedChange={(v) => setConfig({...config, mostrar_dados_empresa: v})}
                  />
                  <Label className="text-sm font-medium">Mostrar Dados da Empresa</Label>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 space-y-1">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Seguro:</strong> Link protegido com token único</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Válido por:</strong> 90 dias</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="bg-blue-600"
                >
                  Gerar Link
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sucesso */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="text-green-700 font-semibold mb-1">Link Gerado com Sucesso!</div>
                <p className="text-xs text-green-600">Válido até {new Date(linkGerado.config.valido_ate).toLocaleDateString('pt-BR')}</p>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Seu Link</Label>
                <div className="flex gap-2 p-2 bg-gray-50 rounded-lg border">
                  <input
                    type="text"
                    value={linkGerado.link_publico}
                    readOnly
                    className="flex-1 bg-transparent text-xs outline-none text-gray-600"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copiarLink}
                    className="h-auto"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Opções de compartilhamento */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Compartilhar</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={compartilharWhatsApp}
                    className="flex-1 gap-2"
                  >
                    <Share2 className="w-4 h-4" /> WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const subject = 'Relatório de Medição';
                      const body = `Acesse o relatório: ${linkGerado.link_publico}`;
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                    }}
                    className="flex-1 gap-2"
                  >
                    Email
                  </Button>
                </div>
              </div>

              {/* Configurações aplicadas */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-xs">
                <p className="font-semibold text-gray-900">Configurações:</p>
                <div className="flex flex-wrap gap-1">
                  {config.mostrar_etapas && <Badge>Etapas</Badge>}
                  {config.mostrar_comentarios && <Badge>Comentários</Badge>}
                  {config.mostrar_anexos && <Badge>Anexos</Badge>}
                  {config.mostrar_assinaturas && <Badge>Assinaturas</Badge>}
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setOpen(false)} className="w-full">Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}