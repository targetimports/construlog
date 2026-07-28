import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Etapa4Revisao({ dadosImport, usuarios = [] }) {
  const responsavel = usuarios.find(u => u.id === dadosImport.responsavelUserId);
  const totalMateriais = dadosImport.materiaisSelecionados.reduce(
    (sum, m) => sum + (m.quantidade * (m.valorUnitario || 0)),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 4: Review Final</CardTitle>
        <p className="text-sm text-gray-600 mt-2">Verifique todos os dados antes de confirmar. Nada será apagado após criação.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Dados da Obra */}
         <div className="bg-gray-50 rounded-lg p-4 space-y-4">
           <h3 className="font-semibold text-gray-900">Resumo da Obra</h3>
           <div className="grid grid-cols-2 gap-4 text-sm">
             <div>
               <p className="text-gray-600">Nome</p>
               <p className="font-semibold text-gray-900">{dadosImport.nomeObra}</p>
             </div>
             <div>
               <p className="text-gray-600">Cliente</p>
               <p className="font-semibold text-gray-900">{dadosImport.cliente}</p>
             </div>
             <div>
               <p className="text-gray-600">Tipo</p>
               <p className="font-semibold text-gray-900 capitalize">{dadosImport.tipo}</p>
             </div>
             <div>
               <p className="text-gray-600">Status</p>
               <p className="font-semibold text-gray-900 capitalize">{dadosImport.status.replace('_', ' ')}</p>
             </div>
             {(dadosImport.endereco || dadosImport.cidade || dadosImport.estado) && (
               <div className="col-span-2">
                 <p className="text-gray-600">Endereço Completo</p>
                 <p className="font-semibold text-gray-900">
                   {dadosImport.endereco ? `${dadosImport.endereco}` : ''}{dadosImport.endereco && (dadosImport.cidade || dadosImport.estado) ? ' - ' : ''}
                   {dadosImport.cidade || ''}{(dadosImport.cidade && dadosImport.estado) ? '/' : ''}{dadosImport.estado || ''}
                   {dadosImport.cep ? ` | CEP: ${dadosImport.cep}` : ''}
                 </p>
               </div>
             )}
             {dadosImport.dataInicio && (
               <div>
                 <p className="text-gray-600">Período</p>
                 <p className="font-semibold text-gray-900">
                   {new Date(dadosImport.dataInicio).toLocaleDateString('pt-BR')} até {dadosImport.dataFim ? new Date(dadosImport.dataFim).toLocaleDateString('pt-BR') : 'TBD'}
                 </p>
               </div>
             )}
           </div>
         </div>

        {/* Responsável */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Responsável da Obra</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {responsavel?.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium">{responsavel?.full_name}</p>
              <p className="text-sm text-gray-600">{responsavel?.cargo || responsavel?.role}</p>
            </div>
          </div>
        </div>

        {/* Materiais Selecionados */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Materiais Selecionados</h3>
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {dadosImport.materiaisSelecionados.map((material, idx) => (
              <div key={material.id} className="p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{idx + 1}. {material.descricao}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {material.quantidade} {material.unidade} × R$ {material.valorUnitario?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <Badge variant="outline">
                    R$ {(material.quantidade * (material.valorUnitario || 0)).toFixed(2)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo Final */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Quantidade de itens:</span>
            <span className="font-semibold">{dadosImport.materiaisSelecionados.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Valor Total estimado:</span>
            <span className="font-semibold text-green-700">R$ {totalMateriais.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
            ✓ Todos os dados acima serão salvos permanentemente no sistema.
          </div>
          <div className="text-xs text-gray-500 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            ℹClique em "Confirmar e Criar Obra" para finalizar. Os materiais aparecerão vinculados automaticamente.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}