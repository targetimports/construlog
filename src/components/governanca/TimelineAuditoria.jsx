import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileCheck, 
  Search, 
  Calendar,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

const acaoConfig = {
  criar: { label: 'Criação', icon: Plus, color: 'text-emerald-400' },
  atualizar: { label: 'Atualização', icon: Edit, color: 'text-blue-400' },
  deletar: { label: 'Exclusão', icon: Trash2, color: 'text-red-400' },
  login: { label: 'Login', icon: CheckCircle2, color: 'text-purple-400' },
  logout: { label: 'Logout', icon: XCircle, color: 'text-gray-400' },
  exportar: { label: 'Exportação', icon: Download, color: 'text-amber-400' },
  aprovar: { label: 'Aprovação', icon: CheckCircle2, color: 'text-emerald-400' },
  rejeitar: { label: 'Rejeição', icon: XCircle, color: 'text-red-400' }
};

export default function TimelineAuditoria({ logs, historico }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [acaoFilter, setAcaoFilter] = useState('todas');
  const [entidadeFilter, setEntidadeFilter] = useState('todas');

  // Filtrar logs
  const logsFiltrados = logs.filter(log => {
    const matchSearch = log.usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       log.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       log.entidade?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAcao = acaoFilter === 'todas' || log.acao === acaoFilter;
    const matchEntidade = entidadeFilter === 'todas' || log.entidade === entidadeFilter;
    return matchSearch && matchAcao && matchEntidade;
  });

  // Entidades únicas
  const entidadesUnicas = [...new Set(logs.map(l => l.entidade).filter(Boolean))];

  // Agrupar por data
  const porData = logsFiltrados.reduce((acc, log) => {
    const data = new Date(log.created_date).toLocaleDateString('pt-BR');
    if (!acc[data]) acc[data] = [];
    acc[data].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                placeholder="Buscar por usuário, ação ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <Select value={acaoFilter} onValueChange={setAcaoFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="todas">Todas Ações</SelectItem>
                <SelectItem value="criar">Criação</SelectItem>
                <SelectItem value="atualizar">Atualização</SelectItem>
                <SelectItem value="deletar">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="aprovar">Aprovação</SelectItem>
                <SelectItem value="rejeitar">Rejeição</SelectItem>
              </SelectContent>
            </Select>

            <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                <SelectItem value="todas">Todas Entidades</SelectItem>
                {entidadesUnicas.map(ent => (
                  <SelectItem key={ent} value={ent}>{ent}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-purple-500" />
            Timeline de Auditoria
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
              {logsFiltrados.length} registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(porData).map(([data, logsData]) => (
            <div key={data} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="text-gray-400 font-medium">{data}</h3>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              <div className="space-y-3 ml-7">
                {logsData.map(log => {
                  const config = acaoConfig[log.acao] || acaoConfig.atualizar;
                  const Icon = config.icon;

                  return (
                    <div key={log.id} className="flex gap-4 p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                      <div className={cn("p-2 rounded-lg h-fit", log.sucesso ? "bg-blue-500/10" : "bg-red-500/10")}>
                        <Icon className={cn("w-4 h-4", log.sucesso ? config.color : "text-red-400")} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                                {config.label}
                              </Badge>
                              {log.entidade && (
                                <Badge variant="outline" className="text-xs text-gray-400">
                                  {log.entidade}
                                </Badge>
                              )}
                              {!log.sucesso && (
                                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                                  Falhou
                                </Badge>
                              )}
                            </div>
                            <p className="text-white font-medium">{log.descricao}</p>
                          </div>
                          <span className="text-gray-500 text-xs">
                            {new Date(log.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Usuário: <span className="text-gray-400">{log.usuario}</span></span>
                          {log.ip_address && (
                            <span>IP: <span className="text-gray-400">{log.ip_address}</span></span>
                          )}
                          {log.entidade_id && (
                            <span>ID: <span className="text-gray-400">{log.entidade_id.substring(0, 8)}...</span></span>
                          )}
                        </div>

                        {log.erro_mensagem && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                            {log.erro_mensagem}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {logsFiltrados.length === 0 && (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Nenhum registro encontrado</h3>
              <p className="text-gray-500">Ajuste os filtros para ver mais resultados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Alterações */}
      {historico.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              Histórico de Alterações Recentes
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                {historico.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {historico.slice(0, 10).map(hist => (
              <div key={hist.id} className="p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs text-gray-400">
                        {hist.entidade}
                      </Badge>
                      <span className="text-white font-medium">{hist.campo_alterado}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Anterior:</span>
                        <span className="text-gray-400 ml-2">{hist.valor_anterior || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Novo:</span>
                        <span className="text-emerald-400 ml-2">{hist.valor_novo}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(hist.created_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Por: <span className="text-gray-400">{hist.usuario}</span>
                  {hist.motivo && <span className="ml-3">• {hist.motivo}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}