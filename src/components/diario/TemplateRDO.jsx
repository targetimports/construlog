import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save, Copy, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function TemplateRDO({ obraId }) {
  const [templates, setTemplates] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [novoTemplate, setNovoTemplate] = useState({
    nome: '',
    descricao: '',
    clima_padrao: 'ensolarado',
    mao_obra_padrao: [],
    equipamentos_padrao: [],
    atividades_padrao: []
  });

  // Carregar templates
  const { data: templatesList = [] } = useQuery({
    queryKey: ['templates', obraId],
    queryFn: async () => {
      try {
        const temps = await base44.entities.TemplateRDO?.filter?.({ obra_id: obraId }) || [];
        return temps;
      } catch {
        return [];
      }
    }
  });

  // Criar template
  const criarMutation = useMutation({
    mutationFn: async () => {
      const dados = {
        ...novoTemplate,
        obra_id: obraId,
        data_criacao: new Date().toISOString()
      };
      
      // Salvar em localStorage como fallback
      const existentes = JSON.parse(localStorage.getItem('templates_rdo') || '[]');
      const templateComId = { ...dados, id: `tmp_${Date.now()}` };
      existentes.push(templateComId);
      localStorage.setItem('templates_rdo', JSON.stringify(existentes));
      
      return templateComId;
    },
    onSuccess: () => {
      toast.success('Template criado');
      setNovoTemplate({
        nome: '',
        descricao: '',
        clima_padrao: 'ensolarado',
        mao_obra_padrao: [],
        equipamentos_padrao: [],
        atividades_padrao: []
      });
      setOpenDialog(false);
    }
  });

  // Aplicar template
  const aplicarTemplate = (template) => {
    const evento = new CustomEvent('aplicar-template-rdo', { 
      detail: template 
    });
    window.dispatchEvent(evento);
    toast.success('Template aplicado ao novo RDO');
  };

  // Deletar template
  const deletarTemplate = (id) => {
    const existentes = JSON.parse(localStorage.getItem('templates_rdo') || '[]');
    const filtrados = existentes.filter(t => t.id !== id);
    localStorage.setItem('templates_rdo', JSON.stringify(filtrados));
    toast.success('Template removido');
  };

  useEffect(() => {
    const existentes = JSON.parse(localStorage.getItem('templates_rdo') || '[]');
    setTemplates(existentes.filter(t => t.obra_id === obraId));
  }, [obraId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Templates RDO</h3>
        <Button onClick={() => setOpenDialog(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {/* Lista de templates */}
      <div className="grid gap-2">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 text-center">Nenhum template criado</p>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{template.nome}</p>
                    <p className="text-xs text-gray-600">{template.descricao}</p>
                    <div className="flex gap-1 mt-2">
                      {template.mao_obra_padrao?.length > 0 && (
                        <Badge className="text-xs">{template.mao_obra_padrao.length}</Badge>
                      )}
                      {template.equipamentos_padrao?.length > 0 && (
                        <Badge className="text-xs">{template.equipamentos_padrao.length}</Badge>
                      )}
                      {template.atividades_padrao?.length > 0 && (
                        <Badge className="text-xs">✓ {template.atividades_padrao.length}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => aplicarTemplate(template)}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletarTemplate(template.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de criação */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Template RDO</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input
                placeholder="Ex: Escavação Padrão"
                value={novoTemplate.nome}
                onChange={(e) => setNovoTemplate({...novoTemplate, nome: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Input
                placeholder="Descrição do template"
                value={novoTemplate.descricao}
                onChange={(e) => setNovoTemplate({...novoTemplate, descricao: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Clima Padrão</label>
              <select
                value={novoTemplate.clima_padrao}
                onChange={(e) => setNovoTemplate({...novoTemplate, clima_padrao: e.target.value})}
                className="w-full p-2 border rounded text-sm"
              >
                <option value="ensolarado">Ensolarado</option>
                <option value="nublado">Nublado</option>
                <option value="chuvoso">Chuvoso</option>
                <option value="tempestade">Tempestade</option>
              </select>
            </div>

            <p className="text-xs text-gray-600">
              Configure mão-obra, equipamentos e atividades no primeiro RDO, depois salve como template
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => criarMutation.mutate()}
              disabled={!novoTemplate.nome}
              className="gap-2"
            >
              <Save className="w-4 h-4" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}