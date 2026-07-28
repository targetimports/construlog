import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';
import { X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

const CATEGORIA_OPCOES = [
  { value: 'sistema', label: 'Sistema' },
  { value: 'processo', label: 'Processo' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'qualidade', label: 'Qualidade' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
];

const STATUS_OPCOES = [
  { value: 'planejada', label: 'Planejada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PRIORIDADE_OPCOES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

const inputCls = 'h-11 bg-white border-gray-300 text-gray-900';

// Rótulo padronizado (espaçamento e asterisco vermelho consistentes em todo o form).
function Campo({ label, required, children, className }) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ImplementacaoForm({ open, onOpenChange, implementacao }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    descricao: '',
    categoria: 'sistema',
    status: 'planejada',
    prioridade: 'media',
    obra_id: '',
    empresa_id: '',
    responsavel: '',
    data_inicio: '',
    data_prevista_conclusao: '',
    percentual_concluido: 0,
    custo_estimado: '',
    beneficios: '',
    observacoes: '',
  });
  const [fotos, setFotos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const fotoInputRef = useRef();
  const docInputRef = useRef();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list(),
  });

  useEffect(() => {
    if (implementacao) {
      setFormData({
        codigo: implementacao.codigo || '',
        titulo: implementacao.titulo || '',
        descricao: implementacao.descricao || '',
        categoria: implementacao.categoria || 'sistema',
        status: implementacao.status || 'planejada',
        prioridade: implementacao.prioridade || 'media',
        obra_id: implementacao.obra_id || '',
        empresa_id: implementacao.empresa_id || '',
        responsavel: implementacao.responsavel || '',
        data_inicio: implementacao.data_inicio || '',
        data_prevista_conclusao: implementacao.data_prevista_conclusao || '',
        percentual_concluido: implementacao.percentual_concluido || 0,
        custo_estimado: implementacao.custo_estimado || '',
        beneficios: implementacao.beneficios || '',
        observacoes: implementacao.observacoes || '',
      });
      setFotos(implementacao.fotos || []);
      setDocumentos(implementacao.documentos || []);
    } else {
      setFormData({
        codigo: '',
        titulo: '',
        descricao: '',
        categoria: 'sistema',
        status: 'planejada',
        prioridade: 'media',
        obra_id: '',
        empresa_id: '',
        responsavel: '',
        data_inicio: '',
        data_prevista_conclusao: '',
        percentual_concluido: 0,
        custo_estimado: '',
        beneficios: '',
        observacoes: '',
      });
      setFotos([]);
      setDocumentos([]);
    }
  }, [implementacao, open]);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (implementacao) {
        return base44.entities.Implementacao.update(implementacao.id, data);
      }
      return base44.entities.Implementacao.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['implementacoes']);
      toast.success(implementacao ? 'Implementação atualizada!' : 'Implementação criada!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const handleFotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFotos(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      setFotos([...fotos, ...uploadedUrls]);
      toast.success(`${files.length} foto(s) adicionada(s)!`);
    } catch (error) {
      toast.error('Erro ao enviar fotos: ' + error.message);
    } finally {
      setUploadingFotos(false);
    }
  };

  const handleDocUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingDocs(true);
    try {
      const uploadedDocs = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedDocs.push({
          nome: file.name,
          url: file_url,
          tipo: file.type,
          data_upload: new Date().toISOString(),
        });
      }
      setDocumentos([...documentos, ...uploadedDocs]);
      toast.success(`${files.length} documento(s) adicionado(s)!`);
    } catch (error) {
      toast.error('Erro ao enviar documentos: ' + error.message);
    } finally {
      setUploadingDocs(false);
    }
  };

  const removerFoto = (index) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  const removerDocumento = (index) => {
    setDocumentos(documentos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      toast.error('Informe o título da implementação.');
      return;
    }
    if (!formData.responsavel) {
      toast.error('Selecione o responsável.');
      return;
    }

    const dataToSave = {
      ...formData,
      custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : null,
      percentual_concluido: parseInt(formData.percentual_concluido) || 0,
      fotos,
      documentos,
    };

    salvarMutation.mutate(dataToSave);
  };

  const set = (campo) => (valor) => setFormData((prev) => ({ ...prev, [campo]: valor }));

  const obraOptions = [
    { value: '', label: 'Nenhuma' },
    ...obras.map((o) => ({ value: o.id, label: o.nome })),
  ];
  const empresaOptions = [
    { value: '', label: 'Nenhuma' },
    ...empresas.map((emp) => ({ value: emp.id, label: emp.nome })),
  ];
  const responsavelOptions = colaboradores.map((c) => ({
    value: c.email || c.nome,
    label: c.nome,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl">
            {implementacao ? 'Editar Implementação' : 'Nova Implementação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Código">
              <Input
                value={formData.codigo}
                onChange={(e) => set('codigo')(e.target.value)}
                className={inputCls}
                placeholder="IMP-001"
              />
            </Campo>
            <Campo label="Categoria" required>
              <ComboboxBusca
                options={CATEGORIA_OPCOES}
                value={formData.categoria}
                onSelect={set('categoria')}
                placeholder="Selecione a categoria"
                searchPlaceholder="Buscar categoria..."
              />
            </Campo>
          </div>

          <Campo label="Título" required>
            <Input
              value={formData.titulo}
              onChange={(e) => set('titulo')(e.target.value)}
              className={inputCls}
              placeholder="Nome da implementação"
              required
            />
          </Campo>

          <Campo label="Descrição">
            <Textarea
              value={formData.descricao}
              onChange={(e) => set('descricao')(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 min-h-24"
              placeholder="Descreva a implementação..."
            />
          </Campo>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Status">
              <ComboboxBusca
                options={STATUS_OPCOES}
                value={formData.status}
                onSelect={set('status')}
                placeholder="Selecione o status"
                searchPlaceholder="Buscar status..."
              />
            </Campo>
            <Campo label="Prioridade">
              <ComboboxBusca
                options={PRIORIDADE_OPCOES}
                value={formData.prioridade}
                onSelect={set('prioridade')}
                placeholder="Selecione a prioridade"
                searchPlaceholder="Buscar prioridade..."
              />
            </Campo>
            <Campo label="% Concluído">
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.percentual_concluido}
                onChange={(e) => set('percentual_concluido')(e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Obra (opcional)">
              <ComboboxBusca
                options={obraOptions}
                value={formData.obra_id}
                onSelect={set('obra_id')}
                placeholder="Selecione a obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra encontrada."
                buscarParaListar
                dicaBusca="Digite para buscar a obra..."
              />
            </Campo>
            <Campo label="Empresa (opcional)">
              <ComboboxBusca
                options={empresaOptions}
                value={formData.empresa_id}
                onSelect={set('empresa_id')}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
                emptyMessage="Nenhuma empresa encontrada."
                buscarParaListar
                dicaBusca="Digite para buscar a empresa..."
              />
            </Campo>
          </div>

          <Campo label="Responsável" required>
            <ComboboxBusca
              options={responsavelOptions}
              value={formData.responsavel}
              onSelect={set('responsavel')}
              placeholder="Selecione o responsável"
              searchPlaceholder="Buscar colaborador..."
              emptyMessage="Nenhum colaborador encontrado."
              buscarParaListar
              dicaBusca="Digite para buscar o colaborador..."
            />
          </Campo>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Data Início">
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => set('data_inicio')(e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Previsão Conclusão">
              <Input
                type="date"
                value={formData.data_prevista_conclusao}
                onChange={(e) => set('data_prevista_conclusao')(e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Custo Estimado (R$)">
              <Input
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => set('custo_estimado')(e.target.value)}
                className={inputCls}
                placeholder="0,00"
              />
            </Campo>
          </div>

          <Campo label="Benefícios Esperados">
            <Textarea
              value={formData.beneficios}
              onChange={(e) => set('beneficios')(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 min-h-20"
              placeholder="Quais benefícios essa implementação trará?"
            />
          </Campo>

          <Campo label="Observações">
            <Textarea
              value={formData.observacoes}
              onChange={(e) => set('observacoes')(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 min-h-20"
              placeholder="Anotações adicionais..."
            />
          </Campo>

          <div className="border-t border-gray-200 pt-4">
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Fotos ({fotos.length})
            </Label>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFotoUpload}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFotos}
              variant="outline"
              className="mb-3 border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {uploadingFotos ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><ImageIcon className="w-4 h-4 mr-2" /> Adicionar Fotos</>
              )}
            </Button>
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Documentos ({documentos.length})
            </Label>
            <input
              ref={docInputRef}
              type="file"
              multiple
              onChange={handleDocUpload}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDocs}
              variant="outline"
              className="mb-3 border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {uploadingDocs ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><FileText className="w-4 h-4 mr-2" /> Adicionar Documentos</>
              )}
            </Button>
            {documentos.length > 0 && (
              <div className="space-y-2">
                {documentos.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{doc.nome}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerDocumento(idx)}
                      className="text-red-600 hover:text-red-700 shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvarMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
