import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Trash2, Copy, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function TemplateManager({ type = 'composicao', open, onClose, onSelect }) {
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const queryClient = useQueryClient();

  // Usa localStorage para templates (poderia ser uma entidade)
  const templates = JSON.parse(localStorage.getItem(`templates_${type}`) || '[]');

  const saveTemplate = (data) => {
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName,
      type,
      data,
      created_at: new Date().toISOString()
    };

    const updatedTemplates = [...templates, newTemplate];
    localStorage.setItem(`templates_${type}`, JSON.stringify(updatedTemplates));
    
    toast.success('Template salvo');
    setTemplateName('');
  };

  const deleteTemplate = (templateId) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    localStorage.setItem(`templates_${type}`, JSON.stringify(updatedTemplates));
    toast.success('Template excluído');
  };

  const applyTemplate = (template) => {
    if (onSelect) {
      onSelect(template.data);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Salvar Novo Template */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-3">Salvar Novo Template</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <Button
                onClick={() => saveTemplate({})}
                disabled={!templateName}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>

          {/* Lista de Templates */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Templates Salvos</h4>
            
            {templates.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-sm">Nenhum template salvo</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-4 h-4 text-amber-600" />
                          <p className="font-medium text-gray-900">{template.name}</p>
                        </div>
                        <p className="text-xs text-gray-600">
                          Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyTemplate(template)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Usar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}