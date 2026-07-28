import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AgendaCalendarioMensal({ eventos }) {
  const [data, setData] = useState(new Date());

  const mes = data.getMonth();
  const ano = data.getFullYear();

  // Primeiro dia do mês e número de dias
  const primeiroDay = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  // Array de dias do mês
  const dias = [];
  for (let i = 0; i < primeiroDay; i++) dias.push(null);
  for (let i = 1; i <= diasNoMes; i++) dias.push(i);

  const handleProxMes = () => {
    setData(new Date(ano, mes + 1, 1));
  };

  const handleMesAnterior = () => {
    setData(new Date(ano, mes - 1, 1));
  };

  const getEventosDoDia = (dia) => {
    if (!dia) return [];
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return eventos.filter(e => {
      const dataEvento = e.data_inicio?.split('T')[0];
      return dataEvento === dataStr;
    });
  };

  const eventosHoje = getEventosDoDia(new Date().getDate());
  const mesHoje = new Date().getMonth();
  const anoHoje = new Date().getFullYear();
  const ehMesAtual = mes === mesHoje && ano === anoHoje;

  const getNomesMeses = () => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const getNomesDias = () => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <div className="space-y-6">
      {/* Header do Calendário */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handleMesAnterior}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
          {getNomesMeses()[mes]} {ano}
        </h2>
        <Button variant="outline" size="sm" onClick={handleProxMes}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid do Calendário */}
      <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-4">
        {/* Header dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {getNomesDias().map(d => (
            <div key={d} className="text-center font-semibold text-gray-500 text-[11px] sm:text-sm py-1 sm:py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {dias.map((dia, idx) => {
            const eventosDodia = dia ? getEventosDoDia(dia) : [];
            const ehHoje = ehMesAtual && dia === new Date().getDate();

            return (
              <div
                key={idx}
                className={`min-h-[3.5rem] p-1 sm:min-h-24 sm:p-2 rounded-lg border transition-colors ${
                  dia === null
                    ? 'bg-gray-50 border-transparent'
                    : ehHoje
                    ? 'bg-blue-50 border-blue-300 border-2'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                {dia && (
                  <>
                    <div className={`text-sm sm:text-lg font-bold sm:mb-1 ${ehHoje ? 'text-blue-600' : 'text-gray-900'}`}>
                      {dia}
                    </div>
                    {eventosDodia.length > 0 && (
                      <>
                        {/* Mobile: bolinhas (mais limpo que texto em célula pequena) */}
                        <div className="flex flex-wrap gap-0.5 sm:hidden">
                          {eventosDodia.slice(0, 4).map((e, i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          ))}
                          {eventosDodia.length > 4 && (
                            <span className="text-[9px] leading-none text-gray-500">+{eventosDodia.length - 4}</span>
                          )}
                        </div>
                        {/* Desktop: chips com título */}
                        <div className="hidden sm:block space-y-1">
                          {eventosDodia.slice(0, 3).map((e, i) => (
                            <div
                              key={i}
                              className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded truncate"
                              title={e.titulo}
                            >
                              {e.titulo}
                            </div>
                          ))}
                          {eventosDodia.length > 3 && (
                            <div className="text-xs text-gray-500 px-2">
                              +{eventosDodia.length - 3} mais
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumo de eventos do dia atual */}
      {ehMesAtual && eventosHoje.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Hoje ({new Date().getDate()})</h3>
          <div className="space-y-2">
            {eventosHoje.map(e => (
              <div key={e.id} className="text-sm text-blue-800">
                <span className="font-medium">{e.titulo}</span>
                {e.data_inicio && (
                  <span className="text-xs text-blue-700 ml-2">
                    {new Date(e.data_inicio).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}