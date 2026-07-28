import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ProductionModeCard from '../components/producao/ProductionModeCard';
import QaGateCard from '../components/producao/QaGateCard';

export default function Producao() {
  const [currentMode, setCurrentMode] = useState('staging');
  const [qaGateStatus, setQaGateStatus] = useState('not_run');

  useEffect(() => {
    // Carregar modo atual
    const fetchMode = async () => {
      try {
        const response = await base44.functions.invoke('getHealthStatus', {});
        // Tentar ler da ConfiguracaoSistema
        const configs = await base44.entities.ConfiguracaoSistema.filter({ chave: 'app_mode' }, undefined, 1).catch(() => []);
        if (configs && configs.length > 0) {
          setCurrentMode(configs[0].valor || 'staging');
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMode();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Produção & Segurança</h1>
        <p className="text-gray-600 mt-2">Gestão de modo produção, QA Gate e backups</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ProductionModeCard 
          currentMode={currentMode} 
          qaGateStatus={qaGateStatus}
          onModeChange={setCurrentMode}
        />
        <QaGateCard onResult={setQaGateStatus} />
      </div>
    </div>
  );
}