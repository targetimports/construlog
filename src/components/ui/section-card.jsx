import React from 'react';
import { cn } from '@/lib/utils';

export function SectionCard({ 
  title, 
  subtitle,
  action,
  children, 
  className,
  headerClassName 
}) {
  return (
    <div className={cn(
      "bg-white rounded-lg shadow-sm border border-gray-100",
      className
    )}>
      {(title || action) && (
        <div className={cn(
          "px-6 py-4 border-b border-gray-100 flex items-center justify-between",
          headerClassName
        )}>
          <div>
            {title && (
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}