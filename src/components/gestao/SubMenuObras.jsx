import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronRight, Home, FileText, CheckSquare, BookOpen, ShoppingCart } from 'lucide-react';

const subMenuItems = [
  { label: 'Minhas Obras', page: 'GestaoObras', icon: Home },
  { label: 'Orçamentos', page: 'Orcamentos', icon: FileText },
  { label: 'Medições', page: 'Medicoes', icon: CheckSquare },
  { label: 'Diário de Obras', page: 'DiarioObra', icon: BookOpen },
  { label: 'Compras', page: 'SuprimentosDashboard', icon: ShoppingCart },
];

export default function SubMenuObras({ currentPage = 'GestaoObras' }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="w-64 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 space-y-2 shadow-lg">
      {subMenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.page;
        
        return (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onMouseEnter={() => setExpandedId(item.page)}
            onMouseLeave={() => setExpandedId(null)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
              ${isActive
                ? 'bg-white/25 text-white shadow-md scale-105'
                : 'text-white/80 hover:bg-white/15 hover:text-white'
              }
            `}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm flex-1">{item.label}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${expandedId === item.page ? 'translate-x-1' : ''}`} />
          </Link>
        );
      })}
    </div>
  );
}