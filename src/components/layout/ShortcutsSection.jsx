import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Star, ArrowUp, ArrowDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShortcutsSection({ shortcuts, onRemove, onReorder }) {
  const handleMoveUp = (index) => {
    if (index > 0) {
      const newShortcuts = [...shortcuts];
      [newShortcuts[index], newShortcuts[index - 1]] = [newShortcuts[index - 1], newShortcuts[index]];
      onReorder(newShortcuts);
    }
  };

  const handleMoveDown = (index) => {
    if (index < shortcuts.length - 1) {
      const newShortcuts = [...shortcuts];
      [newShortcuts[index], newShortcuts[index + 1]] = [newShortcuts[index + 1], newShortcuts[index]];
      onReorder(newShortcuts);
    }
  };

  return (
    <div className="px-3 py-4 border-b border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-blue-600 fill-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">ATALHOS</h3>
      </div>

      {shortcuts.length === 0 ? (
        <p className="text-xs text-gray-500 px-2 py-2">
          Fixe items com a para aparecerem aqui.
        </p>
      ) : (
        <div className="space-y-0.5">
          {shortcuts.map((shortcut, index) => (
            <div key={shortcut.page} className="group">
              <Link
                to={createPageUrl(shortcut.page)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-700 hover:bg-slate-100 transition-all duration-200"
              >
                <span className="font-medium text-sm">{shortcut.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleMoveUp(index);
                    }}
                    disabled={index === 0}
                    className="p-1 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleMoveDown(index);
                    }}
                    disabled={index === shortcuts.length - 1}
                    className="p-1 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onRemove(shortcut.page);
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="Remover atalho"
                  >
                    <X className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}