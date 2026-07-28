import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { menuItems } from '../components/layout/navigation';
import { Star, Check, Plus, ArrowRight, Zap, LayoutDashboard, Users, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GerenciadorAtalhos() {
  const [atalhos, setAtalhos] = useState([]);
  const [acessoRapido, setAcessoRapido] = useState([]);

  useEffect(() => {
    const todasAsAbas = menuItems.flatMap(item => 
      item.submenu 
        ? item.submenu.map(sub => ({ ...sub, categoria: item.name }))
        : [{ ...item, categoria: 'Principal' }]
    );
    setAtalhos(todasAsAbas);

    const salvos = localStorage.getItem('shortcuts-rápido');
    if (salvos) {
      setAcessoRapido(JSON.parse(salvos));
    }
  }, []);

  const toggleAtalho = (page) => {
    setAcessoRapido(prev => {
      const novo = prev.includes(page) 
        ? prev.filter(p => p !== page)
        : [...prev, page].slice(0, 8);
      
      if (!prev.includes(page) && novo.length >= 8) {
        toast.info('Máximo de 8 atalhos atingido');
      }
      
      return novo;
    });
  };

  const salvarAtalhos = () => {
    localStorage.setItem('shortcuts-rápido', JSON.stringify(acessoRapido));
    toast.success('Atalhos salvos com sucesso! ');
    window.dispatchEvent(new Event('storage'));
  };

  const agrupadosPorCategoria = atalhos.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="page-title">Atalhos Rápidos</h1>
        <p className="page-subtitle text-base">Personalize o menu para acesso mais rápido às páginas que mais usa</p>
      </div>

      {/* Status Atalhos Selecionados */}
      {acessoRapido.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white sticky top-6 z-10 shadow-lg">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Atalhos Selecionados</p>
                  <Badge className="bg-blue-400 text-blue-900 font-bold">{acessoRapido.length}/8</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {acessoRapido.map(page => {
                    const atalho = atalhos.find(a => a.page === page);
                    return (
                      <Badge 
                        key={page} 
                        className="bg-white/20 text-white backdrop-blur cursor-pointer hover:bg-white/30 font-medium transition-all"
                        onClick={() => toggleAtalho(page)}
                      >
                        {atalho?.name} ✕
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <Star className="w-6 h-6 text-yellow-300 fill-yellow-300 flex-shrink-0 mt-1" />
            </div>
            <Button 
              onClick={salvarAtalhos}
              className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold py-2 h-10 shadow-md"
            >
              <Check className="w-4 h-4 mr-2" />
              Salvar Atalhos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Meus Atalhos Salvos */}
      {acessoRapido.length > 0 && (
        <div className="space-y-4">
          <h2 className="section-title mb-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            Meus Atalhos Salvos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {acessoRapido.map((page, index) => {
              const atalho = atalhos.find(a => a.page === page);
              
              return (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  className="group card p-5 border-l-4 border-l-blue-600 hover:border-l-blue-700 hover:shadow-lg hover:scale-105 transition-all duration-200 bg-gradient-to-br from-blue-50 to-transparent"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-md">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-gray-900 group-hover:text-blue-700 flex-1 text-sm">{atalho?.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">{atalho?.categoria}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid de Seleção */}
      <div className="space-y-8">
        {Object.entries(agrupadosPorCategoria).map(([categoria, items]) => {
          const categoryColors = {
            'Principal': 'from-purple-500 to-purple-600',
            'Dashboard': 'from-blue-500 to-blue-600',
            'Contatos': 'from-pink-500 to-pink-600',
            'Obras': 'from-orange-500 to-orange-600',
            'Logística': 'from-cyan-500 to-cyan-600',
            'Financeiro': 'from-green-500 to-green-600',
            'Catálogos': 'from-amber-500 to-amber-600',
            'Compras': 'from-red-500 to-red-600',
            'Estoque': 'from-indigo-500 to-indigo-600',
            'Pessoas / RH': 'from-fuchsia-500 to-fuchsia-600',
            'BI & Relatórios': 'from-violet-500 to-violet-600',
            'Usuários': 'from-slate-500 to-slate-600',
            'Ajustes': 'from-gray-500 to-gray-600',
          };
          const categoryColor = categoryColors[categoria] || 'from-blue-500 to-blue-600';
          
          return (
            <div key={categoria}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${categoryColor}`}></div>
                <h3 className="text-lg font-bold text-gray-900">{categoria}</h3>
                <Badge variant="outline" className="ml-auto text-xs">{items.length} páginas</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((item) => {
                  const selecionado = acessoRapido.includes(item.page);
                  const podeSelecionar = selecionado || acessoRapido.length < 8;
                  
                  return (
                    <button
                      key={item.page}
                      onClick={() => podeSelecionar && toggleAtalho(item.page)}
                      disabled={!podeSelecionar}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left overflow-hidden group ${
                        selecionado
                          ? `border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-md scale-105`
                          : podeSelecionar
                          ? `border-gray-200 bg-white hover:border-blue-400 hover:shadow-md hover:scale-102 cursor-pointer`
                          : `border-gray-100 bg-gray-50 cursor-not-allowed opacity-50`
                      }`}
                    >
                      {selecionado && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                      )}
                      <div className="relative flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{categoria}</p>
                        </div>
                        {selecionado && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              <strong className="text-indigo-900">Personalize seu menu:</strong> Selecione até 8 páginas que apareçam como atalhos rápidos. Os atalhos aparecerão na barra lateral na ordem em que foram selecionados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}