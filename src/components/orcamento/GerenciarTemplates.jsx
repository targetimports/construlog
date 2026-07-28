import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function GerenciarTemplates({ onSelectTemplate }) {
  const [showForm, setShowForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ nome: '', tipo_obra: '' });

  const { data: templates = [], refetch } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.TemplateOrcamento.filter({ ativo: true })
  });

  const handleCriarTemplate = async () => {
    if (!newTemplate.nome || !newTemplate.tipo_obra) {
      toast.error('Preencha nome e tipo de obra');
      return;
    }

    try {
      await base44.entities.TemplateOrcamento.create({
        ...newTemplate,
        etapas: [],
        itens: [],
        data_criacao: new Date().toISOString().split('T')[0]
      });
      toast.success('Template criado com sucesso');
      setNewTemplate({ nome: '', tipo_obra: '' });
      setShowForm(false);
      refetch();
    } catch (error) {
      toast.error('Erro ao criar template');
    }
  };

  const handleDuplicar = async (template) => {
    try {
      await base44.entities.TemplateOrcamento.create({
        nome: `${template.nome} (Cópia)`,
        tipo_obra: template.tipo_obra,
        descricao: template.descricao,
        etapas: template.etapas,
        itens: template.itens,
        valor_referencia: template.valor_referencia,
        data_criacao: new Date().toISOString().split('T')[0]
      });
      toast.success('Template duplicado com sucesso');
      refetch();
    } catch (error) {
      toast.error('Erro ao duplicar template');
    }
  };

  const handleDeletar = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este template?')) return;
    
    try {
      await base44.entities.TemplateOrcamento.update(id, { ativo: false });
      toast.success('Template deletado');
      refetch();
    } catch (error) {
      toast.error('Erro ao deletar template');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Meus Templates</h2>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      {showForm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm">Criar Novo Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Nome do template"
              value={newTemplate.nome}
              onChange={(e) => setNewTemplate({ ...newTemplate, nome: e.target.value })}
            />
            <Input
              placeholder="Tipo de obra (ex: Edificação, Infraestrutura)"
              value={newTemplate.tipo_obra}
              onChange={(e) => setNewTemplate({ ...newTemplate, tipo_obra: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleCriarTemplate}
              >
                Criar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm">{template.nome}</CardTitle>
                  <Badge variant="outline" className="mt-2">
                    {template.tipo_obra}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-4">
                {template.etapas?.length || 0} etapas | {template.itens?.length || 0} itens
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => onSelectTemplate?.(template)}
                >
                  <Copy className="w-3 h-3" />
                  Usar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDuplicar(template)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDeletar(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="bg-gray-50">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Nenhum template disponível. Crie um novo!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}