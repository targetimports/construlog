import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap, Building2, FileText, FileCheck, Book, ShoppingCart, ChevronRight, X } from 'lucide-react';

const shortcuts = [
  { icon: Building2, label: 'Minhas Obras', page: 'Obras' },
  { icon: FileText, label: 'Orçamentos', page: 'Orcamentos' },
  { icon: FileCheck, label: 'Medições', page: 'Medicoes' },
  { icon: Book, label: 'Diário de Obras', page: 'DiarioObra' },
  { icon: ShoppingCart, label: 'Compras', page: 'Solicitacoes' },
];

export default function ShortcutsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50 hover:scale-110"
        title="Atalhos rápidos"
      >
        {open ? <X className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
      </button>

      {/* Menu de atalhos */}
      {open && (
        <div className="fixed bottom-24 right-6 w-64 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-2xl z-50 p-4">
          <div className="space-y-1">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <Link
                  key={shortcut.page}
                  to={createPageUrl(shortcut.page)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-all group"
                >
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  <span className="font-medium text-sm flex-1">
                    {shortcut.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}