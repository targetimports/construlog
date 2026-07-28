import React, { useState } from 'react';
import { Users, Plus, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { garantirAcessoColaborador } from '@/components/shared/acessoColaborador';
import { toast } from 'sonner';

export default function ColaboradoresObraGuidado() {
  const navigate = useNavigate();
  const [selectedColaboradores, setSelectedColaboradores] = useState([]);
  const [showFormNovo, setShowFormNovo] = useState(false);
  const [novoColaborador, setNovoColaborador] = useState({
    nome: '',
    cpf: '',
    cargo: 'pedreiro',
    telefone: '',
    email: ''
  });

  // Pega obra_id da URL
  const urlParams = new URLSearchParams(window.location.search);
  const obraId = urlParams.get('obra_id');

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const criarColaboradorMutation = useMutation({
    mutationFn: async (data) => {
      const novo = await base44.entities.Colaborador.create({
        ...data,
        status: 'ativo'
      });
      // Regra-mãe: tornar o colaborador um usuário do sistema (se tiver e-mail + CPF)
      const acesso = await garantirAcessoColaborador({ ...data, id: novo.id });
      if (acesso.status === 'criado') toast.success('Acesso de usuário criado (senha inicial = CPF).');
      else if (acesso.status === 'cpf_invalido' && data.email) toast.info('Colaborador criado. Informe o CPF para gerar o acesso de login.');
      return novo;
    },
    onSuccess: (novoColaborador) => {
      setSelectedColaboradores(prev => [...prev, novoColaborador.id]);
      setNovoColaborador({
        nome: '',
        cpf: '',
        cargo: 'pedreiro',
        telefone: '',
        email: ''
      });
      setShowFormNovo(false);
    }
  });

  const handleCriarColaborador = async (e) => {
    e.preventDefault();
    if (!novoColaborador.nome.trim()) return;
    
    await criarColaboradorMutation.mutateAsync(novoColaborador);
  };

  const handleContinuar = () => {
    if (selectedColaboradores.length === 0) {
      alert('Selecione pelo menos um colaborador para continuar');
      return;
    }
    
    // Redireciona para próxima página com obra_id
    navigate(createPageUrl('OrcamentoMedicaoGuidado') + `?obra_id=${obraId}`);
  };

  const toggleColaborador = (id) => {
    setSelectedColaboradores(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Colaboradores da Obra</h1>
              <p className="text-gray-600">Selecione ou cadastre colaboradores que irão trabalhar nesta obra</p>
            </div>
          </div>
        </div>

        {/* Colaboradores existentes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Colaboradores cadastrados no sistema</h2>
          
          {colaboradores.length === 0 ? (
            <p className="text-gray-600 py-4">Nenhum colaborador cadastrado ainda. Crie um novo colaborador abaixo.</p>
          ) : (
            <div className="grid gap-3 mb-4">
              {colaboradores.map(colaborador => (
                <label key={colaborador.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedColaboradores.includes(colaborador.id)}
                    onChange={() => toggleColaborador(colaborador.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{colaborador.nome}</p>
                    <p className="text-sm text-gray-600">
                      {colaborador.cargo} 
                      {colaborador.telefone && ` • ${colaborador.telefone}`}
                    </p>
                  </div>
                  {selectedColaboradores.includes(colaborador.id) && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Formulário criar novo */}
        {showFormNovo && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cadastrar novo colaborador</h3>
            <form onSubmit={handleCriarColaborador} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={novoColaborador.nome}
                  onChange={(e) => setNovoColaborador({...novoColaborador, nome: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do colaborador"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={novoColaborador.cpf}
                  onChange={(e) => setNovoColaborador({...novoColaborador, cpf: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="000.000.000-00"
                />
                <p className="text-xs text-gray-500 mt-1">Com CPF + e-mail, o colaborador já vira usuário do sistema (senha inicial = CPF).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <select
                  value={novoColaborador.cargo}
                  onChange={(e) => setNovoColaborador({...novoColaborador, cargo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pedreiro">Pedreiro</option>
                  <option value="servente">Servente</option>
                  <option value="encarregado">Encarregado</option>
                  <option value="mestre_obras">Mestre de Obras</option>
                  <option value="engenheiro">Engenheiro</option>
                  <option value="arquiteto">Arquiteto</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="motorista">Motorista</option>
                  <option value="eletricista">Eletricista</option>
                  <option value="encanador">Encanador</option>
                  <option value="pintor">Pintor</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="tel"
                  value={novoColaborador.telefone}
                  onChange={(e) => setNovoColaborador({...novoColaborador, telefone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={novoColaborador.email}
                  onChange={(e) => setNovoColaborador({...novoColaborador, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={criarColaboradorMutation.isPending || !novoColaborador.nome.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  {criarColaboradorMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Cadastrar Colaborador
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFormNovo(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Botão criar novo se não estiver mostrando formulário */}
        {!showFormNovo && (
          <Button
            onClick={() => setShowFormNovo(true)}
            variant="outline"
            className="w-full mb-6 gap-2 py-6 text-base"
          >
            <Plus className="w-5 h-5" />
            Cadastrar novo colaborador
          </Button>
        )}

        {/* Summary */}
        {selectedColaboradores.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-900">
              <strong>{selectedColaboradores.length}</strong> colaborador(es) selecionado(s) para esta obra
            </p>
          </div>
        )}

        {/* Botão continuar */}
        <Button
          onClick={handleContinuar}
          disabled={selectedColaboradores.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-base gap-2"
        >
          Continuar <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}