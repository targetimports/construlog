import React from 'react';
import { cn } from '@/lib/utils';

export default function UserAvatar({ user, size = 'md', className }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const getInitials = () => {
    if (!user?.full_name) return '?';
    return user.full_name.
    split(' ').
    map((n) => n[0]).
    join('').
    toUpperCase().
    slice(0, 2);
  };

  if (user?.avatar_url) {
    return (
      <img
        src={`${user.avatar_url}?v=${Date.now()}`}
        alt={user.full_name || 'User'}
        className={cn(
          'rounded-full object-cover border border-gray-200',
          sizeClasses[size],
          className
        )} />);


  }

  return (
    <div className="bg-white text-zinc-950 text-xs font-bold rounded-full border-2 border-gray-300 flex items-center justify-center w-8 h-8">






      {getInitials()}
    </div>);

}