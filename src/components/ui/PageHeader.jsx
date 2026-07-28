import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ 
  title, 
  subtitle, 
  action, 
  actionLabel, 
  actionIcon: ActionIcon = Plus 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        )}
      </div>
      {action && (
        <Button
          onClick={action}
          className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <ActionIcon className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}