import React from 'react';
import { cn } from '@/lib/utils';

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  badge,
  badgeColor = 'blue',
  iconColor = 'blue',
  className 
}) {
  const iconColors = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50'
  };

  const badgeColors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700'
  };

  return (
    <div className={cn(
      "bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        {Icon && (
          <div className={cn("p-2.5 rounded-lg", iconColors[iconColor] || iconColors.blue)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        {badge && (
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            badgeColors[badgeColor] || badgeColors.blue
          )}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}