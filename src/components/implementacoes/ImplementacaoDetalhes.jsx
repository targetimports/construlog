import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  FileText, 
  Image as ImageIcon,
  TrendingUp
} from 'lucide-react';

export default function ImplementacaoDetalhes({ open, onOpenChange, implementacao }) {
  if (!implementacao) return null;

  const statusConfig = {
    planejada: { color: 'bg-blue-100 text-blue-700', label: 'Planejada' },
    em_andamento: { color: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
    concluida: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
    cancelada: { color: 'bg-red-100 text-red-700', label: 'Cancelada' },
    pausada: { color: 'bg-gray-100 text-gray-600', label: 'Pausada' }
  };

  const prioridadeConfig = {
    baixa: { color: 'bg-blue-100 text-blue-700', label: 'Baixa' },
    media: { color: 'bg-yellow-100 text-yellow-700', label: 'Média' },
    alta: { color: 'bg-orange-100 text-orange-700', label: 'Alta' },
    critica: { color: 'bg-red-100 text-red-700', label: 'Crítica' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl">{implementacao.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Badge className={statusConfig[implementacao.status]?.color}>
              {statusConfig[implementacao.status]?.label}
            </Badge>
            <Badge className={prioridadeConfig[implementacao.prioridade]?.color}>
              {prioridadeConfig[implementacao.prioridade]?.label}
            </Badge>
            <Badge variant="outline" className="border-gray-300 text-gray-500">
              {implementacao.categoria}
            </Badge>
            {implementacao.codigo && (
              <Badge variant="outline" className="border-gray-300 text-gray-500">
                {implementacao.codigo}
              </Badge>
            )}
          </div>

          {implementacao.descricao && (
            <Card className="bg-white border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{implementacao.descricao}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white border-gray-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs text-gray-500">Responsável</div>
                    <div className="text-gray-900 font-medium">{implementacao.responsavel}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {implementacao.percentual_concluido !== undefined && (
              <Card className="bg-white border-gray-300">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="text-xs text-gray-500">Progresso</div>
                      <div className="text-gray-900 font-medium">{implementacao.percentual_concluido}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {implementacao.data_inicio && (
              <Card className="bg-white border-gray-300">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-xs text-gray-500">Data Início</div>
                      <div className="text-gray-900 font-medium">
                        {new Date(implementacao.data_inicio).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {implementacao.data_prevista_conclusao && (
              <Card className="bg-white border-gray-300">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="text-xs text-gray-500">Previsão Conclusão</div>
                      <div className="text-gray-900 font-medium">
                        {new Date(implementacao.data_prevista_conclusao).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {implementacao.custo_estimado && (
              <Card className="bg-white border-gray-300">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="text-xs text-gray-500">Custo Estimado</div>
                      <div className="text-gray-900 font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(implementacao.custo_estimado)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {implementacao.beneficios && (
            <Card className="bg-white border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Benefícios Esperados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{implementacao.beneficios}</p>
              </CardContent>
            </Card>
          )}

          {implementacao.observacoes && (
            <Card className="bg-white border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{implementacao.observacoes}</p>
              </CardContent>
            </Card>
          )}

          {implementacao.fotos && implementacao.fotos.length > 0 && (
            <Card className="bg-white border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Fotos ({implementacao.fotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {implementacao.fotos.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
                    >
                      <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {implementacao.documentos && implementacao.documentos.length > 0 && (
            <Card className="bg-white border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos ({implementacao.documentos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {implementacao.documentos.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="text-gray-900 font-medium">{doc.nome}</div>
                        {doc.data_upload && (
                          <div className="text-xs text-gray-500">
                            {new Date(doc.data_upload).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}