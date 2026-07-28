import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const getInitials = (name) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const statusConfig = {
  'em_andamento': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Em andamento' },
  'em andamento': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Em andamento' },
  'aguardando': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Aguardando' },
  'finalizado': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Finalizado' },
  'concluido': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Finalizado' }
};

export default function TableAtividades({ atividades = [] }) {
  const mockAtividades = [
    {
      id: 1,
      projeto: 'Residencial Aurora',
      descricao: 'Fundação concluída',
      responsavel: 'Ricardo Lima',
      status: 'em andamento',
      data: 'Hoje, 10:45'
    },
    {
      id: 2,
      projeto: 'Edifício Skyline',
      descricao: 'Compra de cimento (500un)',
      responsavel: 'Marcos Souza',
      status: 'aguardando',
      data: 'Ontem, 16:20'
    },
    {
      id: 3,
      projeto: 'Condomínio Viver',
      descricao: 'Inspeção de segurança',
      responsavel: 'Ana Ferreira',
      status: 'finalizado',
      data: '12 Mai, 09:15'
    }
  ];

  const dados = atividades.length > 0 ? atividades : mockAtividades;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
         <h3 className="text-lg font-semibold text-gray-900">Atividades Recentes</h3>
         <a href={createPageUrl('Obras')} className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer">
           Ver tudo
         </a>
       </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-3 font-semibold text-gray-700">PROJETO / OBRA</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">RESPONSÁVEL</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">STATUS</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-700">DATA</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((atividade) => {
              const statusInfo = statusConfig[atividade.status?.toLowerCase()] || statusConfig['em andamento'];
              const initials = getInitials(atividade.responsavel);

              return (
                <tr 
                  key={atividade.id} 
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = createPageUrl(`ObraDetalhes?id=${atividade.id}`)}
                >
                   <td className="py-4 px-3">
                     <div>
                       <p className="text-gray-900 font-medium">{atividade.projeto}</p>
                       <p className="text-gray-500 text-xs">{atividade.descricao}</p>
                     </div>
                   </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                        {initials}
                      </div>
                      <span className="text-gray-900">{atividade.responsavel}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <Badge className={`${statusInfo.bg} ${statusInfo.text} border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="py-4 px-3 text-gray-600">{atividade.data}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}