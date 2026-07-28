import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

export default function Etapa3Informacoes({ dadosImport, setDadosImport, usuarios = [] }) {
  const usuariosSuperiores = usuarios.filter(u => 
    u.role === 'admin' || 
    ['supervisor', 'engenheiro', 'mestre', 'encarregado'].includes(u.cargo?.toLowerCase?.() || '')
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 3: Dados da Obra</CardTitle>
        <p className="text-sm text-gray-600 mt-2">Preencha os dados obrigatórios. Cliente e Responsável não podem ficar em branco.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Nome da Obra */}
        <div>
          <label className="block text-sm font-medium mb-2">Nome da Obra *</label>
          <Input
            value={dadosImport.nomeObra}
            onChange={(e) => setDadosImport({ ...dadosImport, nomeObra: e.target.value })}
            placeholder="Ex: Obra Vila Nova"
          />
        </div>

        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium mb-2">Cliente/Contratante *</label>
          <Input
            value={dadosImport.cliente}
            onChange={(e) => setDadosImport({ ...dadosImport, cliente: e.target.value })}
            placeholder="Ex: Prefeitura de São Paulo"
          />
          <p className="text-xs text-gray-500 mt-1">Se o cliente não existir, será criado automaticamente</p>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium mb-2">Tipo de Obra *</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={dadosImport.tipo}
            onChange={(e) => setDadosImport({ ...dadosImport, tipo: e.target.value })}
          >
            <option value="privada">Privada</option>
            <option value="publica">Pública</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2">Status Inicial *</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={dadosImport.status}
            onChange={(e) => setDadosImport({ ...dadosImport, status: e.target.value })}
          >
            <option value="orcamento">Orçamento</option>
            <option value="a_iniciar">A Iniciar</option>
            <option value="em_andamento">Em Andamento</option>
          </select>
        </div>

        {/* Localização */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Cidade</label>
            <Input
              value={dadosImport.cidade}
              onChange={(e) => setDadosImport({ ...dadosImport, cidade: e.target.value })}
              placeholder="São Paulo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <Input
              value={dadosImport.estado}
              onChange={(e) => setDadosImport({ ...dadosImport, estado: e.target.value })}
              placeholder="SP"
              maxLength="2"
            />
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Data de Início</label>
            <Input
              type="date"
              value={dadosImport.dataInicio}
              onChange={(e) => setDadosImport({ ...dadosImport, dataInicio: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Data de Término (prevista)</label>
            <Input
              type="date"
              value={dadosImport.dataFim}
              onChange={(e) => setDadosImport({ ...dadosImport, dataFim: e.target.value })}
            />
          </div>
        </div>

        {/* Responsável da Obra */}
        <div>
          <label className="block text-sm font-medium mb-2">Responsável da Obra (Supervisor+) *</label>
          
          {usuariosSuperiores.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Nenhum usuário superior cadastrado</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Você precisa cadastrar um usuário com cargo Supervisor, Engenheiro, Mestre ou Encarregado no módulo de Usuários.
                </p>
              </div>
            </div>
          ) : (
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={dadosImport.responsavelUserId || ''}
              onChange={(e) => setDadosImport({ ...dadosImport, responsavelUserId: e.target.value })}
            >
              <option value="">Selecionar responsável...</option>
              {usuariosSuperiores.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.cargo || u.role})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs text-gray-500">
          * Campos obrigatórios
        </div>
      </CardContent>
    </Card>
  );
}