import React, { createContext, useContext, useState, useEffect } from 'react';

const FinancePeriodContext = createContext();

export function FinancePeriodProvider({ children }) {
  const [periodMode, setPeriodMode] = useState('RANGE');
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Persistir em localStorage
  useEffect(() => {
    localStorage.setItem('finance_period_mode', periodMode);
    localStorage.setItem('finance_month', month);
    localStorage.setItem('finance_period_start', periodStart);
    localStorage.setItem('finance_period_end', periodEnd);
  }, [periodMode, month, periodStart, periodEnd]);

  // Carregar do localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('finance_period_mode');
    const savedMonth = localStorage.getItem('finance_month');
    const savedStart = localStorage.getItem('finance_period_start');
    const savedEnd = localStorage.getItem('finance_period_end');

    if (savedMode) setPeriodMode(savedMode);
    if (savedMonth) setMonth(savedMonth);
    if (savedStart) setPeriodStart(savedStart);
    if (savedEnd) setPeriodEnd(savedEnd);
  }, []);

  // Ao mudar o mês, atualizar range
  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    const [year, monthNum] = newMonth.split('-');
    const start = new Date(year, parseInt(monthNum) - 1, 1);
    const end = new Date(year, parseInt(monthNum), 0);
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
  };

  return (
    <FinancePeriodContext.Provider
      value={{
        periodMode,
        setPeriodMode,
        month,
        setMonth: handleMonthChange,
        periodStart,
        setPeriodStart,
        periodEnd,
        setPeriodEnd
      }}
    >
      {children}
    </FinancePeriodContext.Provider>
  );
}

export function useFinancePeriod() {
  const context = useContext(FinancePeriodContext);
  if (!context) {
    throw new Error('useFinancePeriod deve ser usado dentro de FinancePeriodProvider');
  }
  return context;
}