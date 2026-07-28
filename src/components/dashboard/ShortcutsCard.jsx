import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Star, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ShortcutsCard() {
  const [shortcuts, setShortcuts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (currentUser?.id) {
          const stored = localStorage.getItem(`shortcuts:${currentUser.id}`);
          if (stored) {
            setShortcuts(JSON.parse(stored));
          }
        }
      } catch (error) {
        console.error('Erro ao carregar atalhos:', error);
      }
    };
    loadUser();
  }, []);

  if (!user || shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-blue-600 fill-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Atalhos Rápidos</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {shortcuts.slice(0, 8).map((shortcut) => (
          <Link
            key={shortcut.page}
            to={createPageUrl(shortcut.page)}
            className="group flex flex-col items-center justify-center gap-2 p-4 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
              {typeof shortcut.icon === 'function' ? (
                <shortcut.icon className="w-5 h-5 text-blue-600" />
              ) : (
                <Star className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 text-center group-hover:text-blue-600 transition-colors">
              {shortcut.name}
            </span>
          </Link>
        ))}
      </div>

      {shortcuts.length > 8 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            + {shortcuts.length - 8} atalhos no menu lateral
          </p>
        </div>
      )}
    </div>
  );
}