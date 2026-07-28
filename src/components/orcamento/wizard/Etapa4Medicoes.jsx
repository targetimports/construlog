import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, Info } from 'lucide-react';

export default function Etapa4Medicoes({ onDadosCarregados }) {
  const [opcoes, setOpcoes] = useState({
    criarBMInicial: false,
    gerarItensMedicao: false,
  });

  useEffect(() => {
    if (onDadosCarregados) onDadosCarregados(opcoes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes]);

  const handleCheckChange = (field) => {
    setOpcoes((p) => {
      const novo = { ...p, [field]: !p[field] };
      // Se desmarcar "Criar BM", desmarcar também "Gerar itens"
      if (field === 'criarBMInicial' && !novo.criarBMInicial) {
        novo.gerarItensMedicao = false;
      }
      return novo;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Medições</h3>
      <p className="text-sm text-gray-600">
        APENAS inicialização de Boletim de Medição (opcional). Todo cálculo é feito no módulo de Medições.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Aviso importante */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <strong>Esta etapa é opcional.</strong> Você pode criar Boletins de Medição depois no módulo de Medições, clicando "Nova Medição".
            </div>
          </div>

          {/* Checkbox 1: Criar BM */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="criarBMInicial"
              checked={opcoes.criarBMInicial}
              onCheckedChange={() => handleCheckChange('criarBMInicial')}
            />
            <div className="flex-1">
              <Label htmlFor="criarBMInicial" className="font-medium cursor-pointer">
                Criar BM inicial (rascunho)
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Cria um Boletim de Medição vazio com status = RASCUNHO, vinculado à obra. 
                <strong> Requer que uma versão de contrato ATIVA exista para a obra.</strong>
              </p>
            </div>
          </div>

          {/* Checkbox 2: Pré-carregar itens (habilitado só se criar BM) */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="gerarItensMedicao"
              checked={opcoes.gerarItensMedicao}
              onCheckedChange={() => handleCheckChange('gerarItensMedicao')}
              disabled={!opcoes.criarBMInicial}
            />
            <div className="flex-1">
              <Label 
                htmlFor="gerarItensMedicao" 
                className={`font-medium cursor-pointer ${!opcoes.criarBMInicial ? 'text-gray-400' : ''}`}
              >
                Pré-carregar itens do contrato
              </Label>
              <p className={`text-xs mt-1 ${!opcoes.criarBMInicial ? 'text-gray-400' : 'text-gray-500'}`}>
                Copia os itens da versão vigente do contrato para a BM (um BMItem vazio por ContratoItem). 
                Campos de cálculo (anterior, período, acumulado, saldo) ficam zerados e serão preenchidos no módulo de Medições.
              </p>
            </div>
          </div>

          {/* Aviso se não houver contrato e tentar ativar */}
          {opcoes.criarBMInicial && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700">
                Se não existir versão de contrato ativa, o sistema mostrará um erro ao concluir o wizard. 
                Nesse caso, crie o contrato antes de prosseguir.
              </div>
            </div>
          )}

          {/* Info box final */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Info className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <strong>Responsabilidades:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li><strong>Wizard:</strong> Cria BM vazia + copia itens do contrato</li>
                <li><strong>Módulo Medições:</strong> Calcula qtd_anterior, qtd_período, acumulado, saldo, valores, dependências</li>
                <li><strong>Qualquer lugar:</strong> Você pode criar BM manualmente clicando "Nova Medição" fora do wizard</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}