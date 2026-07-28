import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Download, Eye, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

export default function AuditoriaLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModulo, setFilterModulo] = useState('todos');
  const [filterAcao, setFilterAcao] = useState('todas');
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-auditoria'],
    queryFn: () => base44.entities.LogAuditoria.list('-created_date', 100),
    enabled: user?.role === 'admin'
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
    enabled: user?.role === 'admin'
  });

  // Empresa/branding p/ o cabeçalho do Excel (tela sem filtro de obra → matriz).
  const { empresa, branding } = useEmpresaBranding();

  const getUsuarioNome = (email) => {
    const usuario = usuarios.find(u => u.email === email);
    return usuario?.full_name || email;
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = !searchTerm || 
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.acao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.detalhes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchModulo = filterModulo === 'todos' || log.modulo === filterModulo;
    const matchAcao = filterAcao === 'todas' || log.acao === filterAcao;

    return matchSearch && matchModulo && matchAcao;
  });

  const getAcaoIcon = (acao) => {
    if (acao?.includes('criar') || acao?.includes('criar')) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (acao?.includes('atualizar') || acao?.includes('editar')) return <Info className="w-4 h-4 text-blue-600" />;
    if (acao?.includes('excluir') || acao?.includes('deletar')) return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertCircle className="w-4 h-4 text-gray-600" />;
  };

  const getAcaoBadgeColor = (acao) => {
    if (acao?.includes('criar')) return 'bg-green-100 text-green-700';
    if (acao?.includes('atualizar') || acao?.includes('editar')) return 'bg-blue-100 text-blue-700';
    if (acao?.includes('excluir') || acao?.includes('deletar')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Exporta EXCEL branded com exatamente os logs filtrados na tela.
  const exportarExcel = () => {
    if (!filteredLogs.length) { toast.error('Nenhum dado para exportar'); return; }
    exportarXLSXBranded(`auditoria_${format(new Date(), 'yyyy-MM-dd')}`, [{
      nome: 'Logs de Auditoria',
      titulo: 'Logs de Auditoria',
      subtitulo: `${filteredLogs.length} registro(s)`,
      headers: ['Data/Hora', 'Usuário', 'Módulo', 'Ação', 'IP', 'Detalhes'],
      rows: filteredLogs.map((log) => {
        const nome = getUsuarioNome(log.user_email);
        return [
          format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
          nome !== log.user_email ? `${nome} (${log.user_email})` : (log.user_email || '-'),
          log.modulo || 'Sistema',
          log.acao || '-',
          log.ip || '-',
          log.detalhes || '-',
        ];
      }),
      larguras: [20, 38, 14, 18, 16, 60],
    }], { empresa, branding });
  };

  if (!['admin', 'programador'].includes(user?.role) && user?.acesso_global !== true) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Acesso restrito a administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton kpis={4} rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auditoria e Logs</h1>
          <p className="text-gray-600 mt-1">Histórico completo de ações no sistema</p>
        </div>
        <Button onClick={exportarExcel} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Usuários Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(logs.map(l => l.user_email)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Módulos Acessados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(logs.map(l => l.modulo)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Ações Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {logs.filter(l => {
                const today = new Date();
                const logDate = new Date(l.created_date);
                return logDate.toDateString() === today.toDateString();
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Registros de Auditoria</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterModulo} onValueChange={setFilterModulo}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Módulos</SelectItem>
                  <SelectItem value="obras">Obras</SelectItem>
                  <SelectItem value="orcamentos">Orçamentos</SelectItem>
                  <SelectItem value="medicoes">Medições</SelectItem>
                  <SelectItem value="compras">Compras</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="usuarios">Usuários</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAcao} onValueChange={setFilterAcao}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Ações</SelectItem>
                  <SelectItem value="criar">Criação</SelectItem>
                  <SelectItem value="atualizar">Atualização</SelectItem>
                  <SelectItem value="excluir">Exclusão</SelectItem>
                  <SelectItem value="visualizar">Visualização</SelectItem>
                  <SelectItem value="exportar">Exportação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{getUsuarioNome(log.user_email)}</p>
                        <p className="text-xs text-gray-500">{log.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.modulo || 'Sistema'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAcaoIcon(log.acao)}
                        <Badge className={getAcaoBadgeColor(log.acao)}>
                          {log.acao}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">
                      {log.ip || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
            <DialogDescription>Informações completas da ação registrada</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Data/Hora</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedLog.created_date), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Usuário</Label>
                  <p className="text-sm mt-1">{getUsuarioNome(selectedLog.user_email)}</p>
                  <p className="text-xs text-gray-500">{selectedLog.user_email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Módulo</Label>
                  <p className="text-sm mt-1">{selectedLog.modulo || 'Sistema'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Ação</Label>
                  <p className="text-sm mt-1">{selectedLog.acao}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Endereço IP</Label>
                  <p className="text-sm mt-1 font-mono">{selectedLog.ip || 'Não registrado'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">User Agent</Label>
                  <p className="text-sm mt-1 truncate" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || 'Não registrado'}
                  </p>
                </div>
              </div>
              {selectedLog.detalhes && (
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Detalhes</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm whitespace-pre-wrap">{selectedLog.detalhes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }) {
  return <label className={`text-sm font-medium ${className}`}>{children}</label>;
}