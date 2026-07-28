import React from 'react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '../../utils';

export default function CardKPI({ icon: Icon, title, value, badge, badgeColor = 'bg-green-100', badgeTextColor = 'text-green-700', iconBg = 'bg-blue-100', onClick }) {
  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all",
        onClick && "cursor-pointer hover:border-blue-300"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-lg', iconBg)}>
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        {badge && (
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-lg', badgeColor, badgeTextColor)}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}