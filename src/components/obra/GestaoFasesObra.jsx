import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, FileUp, Trash2, CheckCircle2 } from 'lucide-react';

export default function GestaoFasesObra({ obra_id }) {
  const [faseAberta, setFaseAberta] = useState(null);
  const [novaFase, setNovaFase] = useState(null);
  const queryClient = useQueryClient();

  const { data: fases } = useQuery({
    queryKey: ['fases', obra_id],
    queryFn: () => base44.entities.Fase.filter({ obra_id })
  });

  const { data: anexos } = useQuery({
    queryKey: ['anexos-fases', faseAberta?.id],
    queryFn: () => base44.entities.AnexoFase.filter({ fase_id: faseAberta?.id }),
    enabled: !!faseAberta
  });

  // Mutation criar/atualizar fase
  const { mutate: salvarFase, isLoading: salvando } = useMutation({
    mutationFn: async (dados) => {
      if (novaFase?.id) {
        return base44.entities.Fase.update(novaFase.id, dados);
      } else {
        return base44.entities.Fase.create({ obra_id, ...dados });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fases'] });
      setNovaFase(null);
    }
  });

  // Mutation deletar fase
  const { mutate: deletarFase } = useMutation({
    mutationFn: (faseId) => base44.entities.Fase.delete(faseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fases'] });
      setFaseAberta(null);
    }
  });

  // Upload de anexo
  const { mutate: uploadAnexo, isLoading: uploading } = useMutation({
    mutationFn: async (file) => {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.AnexoFase.create({
        fase_id: faseAberta.id,
        obra_id,
        arquivo_url: uploadResponse.file_url,
        arquivo_nome: file.name,
        tipo: file.type.includes('image') ? 'foto' : 'documento',
        uploader_email: (await base44.auth.me()).email
      });
      return uploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anexos-fases'] });
    }
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="fases" className="w-full">
        <TabsList>
          <TabsTrigger value="fases">Fases</TabsTrigger>
          <TabsTrigger value="marcos">Marcos</TabsTrigger>
        </TabsList>

        {/* ABA FASES */}
        <TabsContent value="fases" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Fases da Obra</h3>
            <Button
              onClick={() => setNovaFase({})}
              className="gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Nova Fase
            </Button>
          </div>

          {/* Formulário nova fase */}
          {novaFase && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nome da fase"
                    value={novaFase.nome || ''}
                    onChange={(e) => setNovaFase({ ...novaFase, nome: e.target.value })}
                    className="col-span-2 px-3 py-2 border rounded-lg"
                  />
                  <div>
                    <label className="text-xs text-gray-700">Início</label>
                    <input
                      type="date"
                      value={novaFase.data_inicio || ''}
                      onChange={(e) => setNovaFase({ ...novaFase, data_inicio: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700">Fim</label>
                    <input
                      type="date"
                      value={novaFase.data_fim || ''}
                      onChange={(e) => setNovaFase({ ...novaFase, data_fim: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <textarea
                    placeholder="Descrição"
                    value={novaFase.descricao || ''}
                    onChange={(e) => setNovaFase({ ...novaFase, descricao: e.target.value })}
                    className="col-span-2 px-3 py-2 border rounded-lg h-20"
                  />
                  <input
                    type="number"
                    placeholder="Orçamento previsto"
                    value={novaFase.orcamento_previsto || ''}
                    onChange={(e) => setNovaFase({ ...novaFase, orcamento_previsto: parseFloat(e.target.value) })}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="% Progresso"
                    min="0"
                    max="100"
                    value={novaFase.percentual_concluido || ''}
                    onChange={(e) => setNovaFase({ ...novaFase, percentual_concluido: parseFloat(e.target.value) })}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setNovaFase(null)} size="sm">
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => salvarFase(novaFase)}
                    disabled={!novaFase.nome || !novaFase.data_inicio || salvando}
                    size="sm"
                  >
                    {salvando ? 'Salvando...' : 'Salvar Fase'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de fases */}
          <div className="space-y-3">
            {fases?.sort((a, b) => a.ordem - b.ordem).map(fase => (
              <Card
                key={fase.id}
                className={`cursor-pointer transition ${faseAberta?.id === fase.id ? 'border-blue-500 bg-blue-50' : ''}`}
                onClick={() => setFaseAberta(fase)}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-gray-900">{fase.nome}</h4>
                        <span
                          className={`px-2 py-1 text-xs rounded font-semibold ${
                            fase.status === 'concluida'
                              ? 'bg-green-100 text-green-800'
                              : fase.status === 'em_progresso'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {fase.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{fase.descricao}</p>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>{new Date(fase.data_inicio).toLocaleDateString('pt-BR')} a {new Date(fase.data_fim).toLocaleDateString('pt-BR')}</span>
                        <span>{fase.percentual_concluido}% concluído</span>
                      </div>
                      {/* Barra de progresso */}
                      <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition"
                          style={{ width: `${fase.percentual_concluido}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletarFase(fase.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ABA ANEXOS */}
        {faseAberta && (
          <TabsContent value="marcos" className="space-y-4 mt-6">
            <h3 className="font-bold text-gray-900">Documentos e Fotos - {faseAberta.nome}</h3>

            {/* Upload */}
            <Card>
              <CardContent className="pt-6">
                <label className="block">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        uploadAnexo(e.target.files[0]);
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button className="w-full cursor-pointer gap-2" disabled={uploading}>
                    <FileUp className="w-4 h-4" />
                    {uploading ? 'Enviando...' : 'Enviar Documento/Foto'}
                  </Button>
                </label>
              </CardContent>
            </Card>

            {/* Lista anexos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {anexos?.map(anexo => (
                <Card key={anexo.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {anexo.tipo === 'foto' ? (
                        <img
                          src={anexo.arquivo_url}
                          alt={anexo.arquivo_nome}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                          
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{anexo.arquivo_nome}</p>
                        <p className="text-xs text-gray-600">{anexo.tipo}</p>
                        <a
                          href={anexo.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Visualizar
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}