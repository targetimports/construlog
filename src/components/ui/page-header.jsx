import React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export function PageHeader({ 
  title, 
  subtitle, 
  action, 
  actionLabel,
  actionIcon: ActionIcon,
  secondaryAction,
  secondaryActionLabel,
  className 
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3">
            {secondaryAction && (
              <Button 
                variant="outline" 
                onClick={secondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {action && (
              <Button onClick={action}>
                {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}