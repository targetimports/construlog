import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users, 
  Truck, 
  DollarSign,
  FileText,
  Calendar,
  ArrowRight,
  Loader2,
  BarChart3,
  Activity,
  Fuel,
  Package,
  TrendingDown,
  Zap,
  Shield,
  Target,
  MessageCircle,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ConfiguracaoWhatsApp from './ConfiguracaoWhatsApp';

export default function SupervisorOperacional() {
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [notificando, setNotificando] = useState(false);
  const [whatsappConectado, setWhatsappConectado] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  useEffect(() => {
    const conectado = localStorage.getItem('whatsapp_conectado') === 'true';
    setWhatsappConectado(conectado);
  }, []);

  // Buscar dados do sistema
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.OrcamentoObra.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.MedicaoObra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abastecimentos'],
    queryFn: () => base44.entities.Abastecimento.list()
  });

  const { data: viagens = [] } = useQuery({
    queryKey: ['viagens'],
    queryFn: () => base44.entities.Viagem.list()
  });

  const { data: orcamentosItens = [] } = useQuery({
    queryKey: ['orcamentos-itens'],
    queryFn: () => base44.entities.OrcamentoItem.list()
  });

  const { data: materiaisEstoque = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ['apontamentos'],
    queryFn: () => base44.entities.ApontamentoHoras.list()
  });

  const { data: alertasSupervisor = [], refetch: refetchAlertas } = useQuery({
    queryKey: ['alertas-supervisor'],
    queryFn: () => base44.entities.AlertaSupervisor.filter({ status: 'OPEN' }),
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  // Função para criar ou atualizar alerta com deduplicação
  const createOrUpdateAlert = async (alertData) => {
    const now = new Date().toISOString();
    const cooldownHours = 24;

    try {
      const existingAlerts = await base44.entities.AlertaSupervisor.filter({
        alert_key: alertData.alert_key,
        funcao_alvo: 'admin',
        status: 'OPEN'
      });

      const existing = existingAlerts[0];

      if (existing) {
        const lastSeenDate = new Date(existing.last_seen_at);
        const hoursSinceLastSeen = (new Date(now) - lastSeenDate) / (1000 * 60 * 60);

        if (hoursSinceLastSeen < cooldownHours) {
          await base44.entities.AlertaSupervisor.update(existing.id, {
            last_seen_at: now,
            occurrences_count: (existing.occurrences_count || 1) + 1,
            message: alertData.message,
            context_json: alertData.context_json
          });
          return existing;
        }
      }

      const cooldownUntil = new Date(new Date(now).getTime() + cooldownHours * 60 * 60 * 1000).toISOString();
      
      const newAlert = await base44.entities.AlertaSupervisor.create({
        ...alertData,
        funcao_alvo: 'admin',
        first_seen_at: now,
        last_seen_at: now,
        cooldown_until: cooldownUntil,
        occurrences_count: 1,
        status: 'OPEN'
      });

      return newAlert;
    } catch (error) {
      console.error('Erro ao criar/atualizar alerta:', error);
      return null;
    }
  };

  // Análise inteligente dos dados
  useEffect(() => {
    if (!obras.length && !orcamentos.length && !colaboradores.length) return;

    setAnalyzing(true);
    
    setTimeout(async () => {
      const alerts = [];
      const actions = [];
      const metricas = {
        financeiro: 0,
        operacional: 0,
        logistica: 0,
        rh: 0,
        qualidade: 0
      };

      // ==================== ORÇAMENTO E CUSTOS ====================
      
      // Verificar obras sem orçamento
      const obrasSemOrcamento = obras.filter(obra => {
        const temOrcamento = orcamentos.some(orc => orc.obra_id === obra.id);
        return !temOrcamento && obra.status !== 'cancelada';
      });
      
      if (obrasSemOrcamento.length > 0) {
        const alertDb = await createOrUpdateAlert({
          alert_key: 'OBRA_SEM_ORCAMENTO:GLOBAL',
          severity: 'CRITICO',
          type: 'critical',
          level: 'URGENTE',
          title: `${obrasSemOrcamento.length} obra(s) sem orçamento cadastrado`,
          message: 'Obras precisam de orçamento para controle de custos',
          context_json: { 
            count: obrasSemOrcamento.length,
            obra_ids: obrasSemOrcamento.map(o => o.id)
          }
        });

        alerts.push({
          id: alertDb?.id || 'obras-sem-orcamento',
          type: 'critical',
          level: 'URGENTE',
          icon: FileText,
          title: `${obrasSemOrcamento.length} obra(s) sem orçamento cadastrado`,
          description: 'Obras precisam de orçamento para controle de custos',
          obras: obrasSemOrcamento,
          occurrences_count: alertDb?.occurrences_count || 1,
          action: {
            label: 'Criar orçamento',
            onClick: () => navigate(createPageUrl('Orcamentos'))
          }
        });
        metricas.financeiro -= 20;
      }

      // Verificar orçamentos sem detalhamento
      const orcamentosSemItens = orcamentos.filter(orc => 
        orc.status === 'rascunho' && (!orc.valor_total || orc.valor_total === 0)
      );
      
      if (orcamentosSemItens.length > 0) {
        alerts.push({
          id: 'orcamentos-sem-itens',
          type: 'warning',
          level: 'CRÍTICO',
          icon: BarChart3,
          title: `${orcamentosSemItens.length} orçamento(s) sem detalhamento`,
          description: 'Orçamentos precisam de composições e valores',
          action: {
            label: 'Detalhar orçamentos',
            onClick: () => navigate(createPageUrl('Orcamentos'))
          }
        });
        metricas.financeiro -= 10;
      }

      // Análise de desvio orçamentário
      orcamentos.forEach(orc => {
        if (orc.obra_id && orc.valor_total > 0) {
          const obra = obras.find(o => o.id === orc.obra_id);
          if (obra && obra.valor_realizado > 0) {
            const desvio = ((obra.valor_realizado - orc.valor_total) / orc.valor_total) * 100;
            if (desvio > 15) {
              alerts.push({
                id: `desvio-${orc.id}`,
                type: desvio > 25 ? 'critical' : 'warning',
                level: desvio > 25 ? 'CRÍTICO' : 'ATENÇÃO',
                icon: TrendingDown,
                title: `Desvio de ${desvio.toFixed(1)}% no orçamento`,
                description: `${obra.nome}: R$ ${obra.valor_realizado.toLocaleString('pt-BR')} realizado vs R$ ${orc.valor_total.toLocaleString('pt-BR')} planejado`,
                action: {
                  label: 'Ver orçamento',
                  onClick: () => navigate(createPageUrl('OrcamentoDetalhes') + `?id=${orc.id}`)
                }
              });
              metricas.financeiro -= desvio > 25 ? 15 : 8;
            }
          }
        }
      });

      // ==================== COLABORADORES E RH ====================
      
      const obrasAtivas = obras.filter(o => o.status === 'em_andamento');
      const obrasSemColaboradores = obrasAtivas.filter(obra => {
        const temColaborador = colaboradores.some(col => 
          col.obra_atual_id === obra.id && col.status === 'ativo'
        );
        return !temColaborador;
      });
      
      if (obrasSemColaboradores.length > 0) {
        const alertDb = await createOrUpdateAlert({
          alert_key: 'OBRA_SEM_COLABORADORES:GLOBAL',
          severity: 'ALTO',
          type: 'warning',
          level: 'CRÍTICO',
          title: `${obrasSemColaboradores.length} obra(s) ativa(s) sem colaboradores`,
          message: 'Alocar equipe é essencial para execução',
          context_json: { 
            count: obrasSemColaboradores.length,
            obra_ids: obrasSemColaboradores.map(o => o.id)
          }
        });

        alerts.push({
          id: alertDb?.id || 'obras-sem-colaboradores',
          type: 'warning',
          level: 'CRÍTICO',
          icon: Users,
          title: `${obrasSemColaboradores.length} obra(s) ativa(s) sem colaboradores`,
          description: 'Alocar equipe é essencial para execução',
          obras: obrasSemColaboradores,
          occurrences_count: alertDb?.occurrences_count || 1,
          action: {
            label: 'Alocar colaboradores',
            onClick: () => navigate(createPageUrl('Colaboradores'))
          }
        });
        metricas.rh -= 15;
      }

      // Análise de produtividade por colaborador
      if (apontamentos.length > 0) {
        const horasPorColaborador = {};
        apontamentos.forEach(apt => {
          if (apt.colaborador_id) {
            horasPorColaborador[apt.colaborador_id] = (horasPorColaborador[apt.colaborador_id] || 0) + (apt.horas || 0);
          }
        });

        // Detectar colaboradores sem apontamento
        const colaboradoresAtivos = colaboradores.filter(c => c.status === 'ativo');
        const semApontamento = colaboradoresAtivos.filter(c => !horasPorColaborador[c.id]);
        
        if (semApontamento.length > 0) {
          alerts.push({
            id: 'colaboradores-sem-apontamento',
            type: 'info',
            level: 'ATENÇÃO',
            icon: Clock,
            title: `${semApontamento.length} colaborador(es) sem apontamento de horas`,
            description: 'Registrar horas trabalhadas para controle de produtividade',
            action: {
              label: 'Apontar horas',
              onClick: () => navigate(createPageUrl('ApontamentoHoras'))
            }
          });
          metricas.rh -= 5;
        }
      }

      // ==================== LOGÍSTICA E COMBUSTÍVEL ====================
      
      if (motoristas.length === 0 && veiculos.length > 0) {
        alerts.push({
          id: 'sem-motoristas',
          type: 'warning',
          level: 'ATENÇÃO',
          icon: Truck,
          title: 'Nenhum motorista cadastrado',
          description: 'Cadastre motoristas para gerenciar logística',
          action: {
            label: 'Cadastrar motorista',
            onClick: () => navigate(createPageUrl('Motoristas'))
          }
        });
        metricas.logistica -= 10;
      }

      // Análise de consumo de combustível
      if (abastecimentos.length > 0 && veiculos.length > 0) {
        const consumoPorVeiculo = {};
        const viagensPorVeiculo = {};

        abastecimentos.forEach(abast => {
          if (!consumoPorVeiculo[abast.veiculo_id]) {
            consumoPorVeiculo[abast.veiculo_id] = { litros: 0, valor: 0, count: 0 };
          }
          consumoPorVeiculo[abast.veiculo_id].litros += abast.litros || 0;
          consumoPorVeiculo[abast.veiculo_id].valor += abast.valor_total || 0;
          consumoPorVeiculo[abast.veiculo_id].count += 1;
        });

        viagens.forEach(viagem => {
          if (viagem.veiculo_id && viagem.km_rodado) {
            if (!viagensPorVeiculo[viagem.veiculo_id]) {
              viagensPorVeiculo[viagem.veiculo_id] = 0;
            }
            viagensPorVeiculo[viagem.veiculo_id] += viagem.km_rodado;
          }
        });

        // Calcular consumo médio e detectar anomalias
        Object.keys(consumoPorVeiculo).forEach(veiculoId => {
          const veiculo = veiculos.find(v => v.id === veiculoId);
          const consumo = consumoPorVeiculo[veiculoId];
          const kmRodado = viagensPorVeiculo[veiculoId] || 0;

          if (kmRodado > 0) {
            const consumoPorKm = consumo.litros / kmRodado;
            const baseline = 0.15; // 15L/100km = 0.15L/km baseline

            // Detectar consumo excessivo (>20% acima do baseline)
            if (consumoPorKm > baseline * 1.2) {
              const desvio = ((consumoPorKm - baseline) / baseline) * 100;
              alerts.push({
                id: `consumo-${veiculoId}`,
                type: 'warning',
                level: 'ATENÇÃO',
                icon: Fuel,
                title: `Consumo elevado: ${veiculo?.placa || 'Veículo'}`,
                description: `${consumoPorKm.toFixed(2)} L/km (${desvio.toFixed(0)}% acima do esperado)`,
                action: {
                  label: 'Ver veículo',
                  onClick: () => navigate(createPageUrl('VeiculoDetalhes') + `?id=${veiculoId}`)
                }
              });
              metricas.logistica -= 8;
            }
          }

          // Detectar abastecimentos sem viagem
          if (consumo.count > 0 && kmRodado === 0) {
            alerts.push({
              id: `abast-sem-viagem-${veiculoId}`,
              type: 'info',
              level: 'INFO',
              icon: AlertTriangle,
              title: `${veiculo?.placa || 'Veículo'}: abastecimentos sem viagens registradas`,
              description: 'Registre viagens para análise de consumo',
              action: {
                label: 'Ver veículo',
                onClick: () => navigate(createPageUrl('VeiculoDetalhes') + `?id=${veiculoId}`)
              }
            });
          }
        });
      }

      // Motoristas sem viagens
      if (motoristas.length > 0 && viagens.length > 0) {
        const motoristasComViagem = new Set(viagens.map(v => v.motorista_id).filter(Boolean));
        const motoristasSemViagem = motoristas.filter(m => !motoristasComViagem.has(m.id));
        
        if (motoristasSemViagem.length > 0) {
          alerts.push({
            id: 'motoristas-sem-viagem',
            type: 'info',
            level: 'INFO',
            icon: Truck,
            title: `${motoristasSemViagem.length} motorista(s) sem viagens registradas`,
            description: 'Atribuir viagens para controle logístico',
            action: {
              label: 'Ver motoristas',
              onClick: () => navigate(createPageUrl('Motoristas'))
            }
          });
        }
      }

      // ==================== MEDIÇÕES E FATURAMENTO ====================
      
      const medicoesPendentes = medicoes.filter(m => m.status === 'pendente');
      if (medicoesPendentes.length > 0) {
        alerts.push({
          id: 'medicoes-pendentes',
          type: 'warning',
          level: 'ATENÇÃO',
          icon: Clock,
          title: `${medicoesPendentes.length} medição(ões) pendente(s) de aprovação`,
          description: 'Aprovar medições para faturamento',
          action: {
            label: 'Revisar medições',
            onClick: () => navigate(createPageUrl('Medicoes'))
          }
        });
        metricas.operacional -= 10;
      }

      // ==================== FINANCEIRO ====================
      
      const hoje = new Date();
      const proximos7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      const pagamentosProximos = contas.filter(c => {
        if (!c.data_vencimento || c.status !== 'pendente' || c.tipo !== 'pagar') return false;
        const vencimento = new Date(c.data_vencimento);
        return vencimento >= hoje && vencimento <= proximos7Dias;
      });

      if (pagamentosProximos.length > 0) {
        const valorTotal = pagamentosProximos.reduce((acc, c) => acc + (c.valor || 0), 0);
        alerts.push({
          id: 'pagamentos-proximos',
          type: 'info',
          level: 'INFO',
          icon: DollarSign,
          title: `${pagamentosProximos.length} pagamento(s) nos próximos 7 dias`,
          description: `Valor total: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          action: {
            label: 'Ver financeiro',
            onClick: () => navigate(createPageUrl('Financeiro'))
          }
        });
      }

      // Verificar contas atrasadas
      const contasAtrasadas = contas.filter(c => {
        if (!c.data_vencimento || c.status !== 'pendente') return false;
        return new Date(c.data_vencimento) < hoje;
      });

      if (contasAtrasadas.length > 0) {
        const valorTotal = contasAtrasadas.reduce((acc, c) => acc + (c.valor || 0), 0);
        const alertDb = await createOrUpdateAlert({
          alert_key: 'CONTAS_ATRASADAS:GLOBAL',
          severity: 'CRITICO',
          type: 'critical',
          level: 'URGENTE',
          title: `${contasAtrasadas.length} conta(s) atrasada(s)`,
          message: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso`,
          context_json: { 
            count: contasAtrasadas.length,
            valor_total: valorTotal,
            conta_ids: contasAtrasadas.map(c => c.id)
          }
        });

        alerts.push({
          id: alertDb?.id || 'contas-atrasadas',
          type: 'critical',
          level: 'URGENTE',
          icon: AlertTriangle,
          title: `${contasAtrasadas.length} conta(s) atrasada(s)`,
          description: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso`,
          occurrences_count: alertDb?.occurrences_count || 1,
          action: {
            label: 'Ver pendências',
            onClick: () => navigate(createPageUrl('Financeiro'))
          }
        });
        metricas.financeiro -= 20;
      }

      // ==================== CRONOGRAMA E PRAZOS ====================
      
      const obrasAtrasadas = obras.filter(obra => {
        if (!obra.data_prevista_fim || obra.status === 'concluida') return false;
        return new Date(obra.data_prevista_fim) < hoje;
      });

      if (obrasAtrasadas.length > 0) {
        alerts.push({
          id: 'obras-atrasadas',
          type: 'critical',
          level: 'URGENTE',
          icon: AlertTriangle,
          title: `${obrasAtrasadas.length} obra(s) com cronograma atrasado`,
          description: 'Revisar prazos e acelerar execução',
          obras: obrasAtrasadas,
          action: {
            label: 'Ver obras',
            onClick: () => navigate(createPageUrl('Obras'))
          }
        });
        metricas.qualidade -= 15;
      }

      // ==================== ESTOQUE ====================
      
      const materiaisBaixoEstoque = materiaisEstoque.filter(m => 
        m.estoque_atual > 0 && m.estoque_minimo > 0 && m.estoque_atual <= m.estoque_minimo
      );

      if (materiaisBaixoEstoque.length > 0) {
        alerts.push({
          id: 'estoque-baixo',
          type: 'warning',
          level: 'ATENÇÃO',
          icon: Package,
          title: `${materiaisBaixoEstoque.length} material(is) com estoque baixo`,
          description: 'Repor estoque para evitar paralisações',
          action: {
            label: 'Ver estoque',
            onClick: () => navigate(createPageUrl('Estoque'))
          }
        });
        metricas.operacional -= 8;
      }

      // Gerar ações rápidas sugeridas
      if (obras.length === 0) {
        actions.push({
          id: 'criar-primeira-obra',
          priority: 'high',
          label: 'Criar sua primeira obra',
          icon: TrendingUp,
          onClick: () => navigate(createPageUrl('Obras'))
        });
      }

      if (colaboradores.length === 0) {
        actions.push({
          id: 'cadastrar-equipe',
          priority: 'medium',
          label: 'Cadastrar colaboradores',
          icon: Users,
          onClick: () => navigate(createPageUrl('Colaboradores'))
        });
      }

      // ==================== CALCULAR SCORE OPERACIONAL ====================
      
      // Score base: 100 pontos
      let scoreTotal = 100;
      scoreTotal += metricas.financeiro;
      scoreTotal += metricas.operacional;
      scoreTotal += metricas.logistica;
      scoreTotal += metricas.rh;
      scoreTotal += metricas.qualidade;

      // Bonificações por boa gestão
      if (orcamentos.length > 0 && obrasSemOrcamento.length === 0) scoreTotal += 5;
      if (colaboradores.length > 0 && obrasSemColaboradores.length === 0) scoreTotal += 5;
      if (contasAtrasadas.length === 0) scoreTotal += 10;
      if (obrasAtrasadas.length === 0) scoreTotal += 10;

      // Limitar entre 0-100
      scoreTotal = Math.max(0, Math.min(100, scoreTotal));

      setAnalysis({
        alerts: alerts.sort((a, b) => {
          const priority = { critical: 3, warning: 2, info: 1 };
          return priority[b.type] - priority[a.type];
        }),
        actions,
        summary: {
          totalObras: obras.length,
          obrasAtivas: obrasAtivas.length,
          totalAlertas: alerts.length,
          alertasCriticos: alerts.filter(a => a.type === 'critical').length,
          alertasUrgentes: alerts.filter(a => a.level === 'URGENTE').length
        },
        score: {
          total: Math.round(scoreTotal),
          detalhes: {
            financeiro: Math.round(100 + metricas.financeiro),
            operacional: Math.round(100 + metricas.operacional),
            logistica: Math.round(100 + metricas.logistica),
            rh: Math.round(100 + metricas.rh),
            qualidade: Math.round(100 + metricas.qualidade)
          }
        }
      });
      
      setAnalyzing(false);
    }, 1500);
  }, [obras, orcamentos, colaboradores, motoristas, medicoes, contas, veiculos, abastecimentos, viagens, orcamentosItens, materiaisEstoque, apontamentos]);

  const handleNotificarWhatsApp = async () => {
    if (!whatsappConectado) {
      setShowConfig(true);
      return;
    }

    setNotificando(true);
    try {
      const alertasUrgentes = analysis.alerts.filter(a => a.level === 'URGENTE' || a.level === 'CRÍTICO');
      const mensagem = `🚨 *ALERTA OPERACIONAL - SUPERVISOR IA*\n\n📊 *Score Operacional:* ${analysis.score.total}/100\n⚠️ *Total de Alertas:* ${analysis.summary.totalAlertas}\n🔴 *Urgentes:* ${alertasUrgentes.length}\n\n*Alertas Críticos:*\n${alertasUrgentes.slice(0, 5).map(a => `• ${a.title}`).join('\n')}${alertasUrgentes.length > 5 ? `\n• +${alertasUrgentes.length - 5} mais` : ''}\n\n📈 Acesse o Supervisor IA para análise completa.`;
      
      await base44.functions.invoke('enviarWhatsAppAlerta', {
        mensagem,
        user_email: user?.email,
        tipo_alerta: 'operacional'
      });
      
      alert('✅ Alerta enviado via WhatsApp com sucesso!');
    } catch (error) {
      alert('Erro ao enviar: ' + error.message);
    } finally {
      setNotificando(false);
    }
  };

  if (analyzing) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analisando sistema...</h3>
          <p className="text-sm text-gray-600">Verificando obras, orçamentos, equipe e finanças</p>
        </div>
      </div>
    );
  }

  const alertTypeConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500' }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Atenção';
    return 'Crítico';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              Supervisor Operacional IA
            </h1>
            <p className="text-gray-600 mt-1">Monitoramento inteligente e orientação em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-8 px-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              Ativo
            </Badge>

            <Badge 
              variant="outline" 
              className={`h-8 px-3 ${whatsappConectado ? 'border-green-300 bg-green-50' : 'border-gray-300'}`}
            >
              <MessageCircle className={`w-3 h-3 mr-1.5 ${whatsappConectado ? 'text-green-600' : 'text-gray-500'}`} />
              {whatsappConectado ? 'WhatsApp ✓' : 'WhatsApp'}
            </Badge>

            <Button
              onClick={() => setShowConfig(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Config
            </Button>

            {analysis?.summary.totalAlertas > 0 && (
              <Button
                onClick={handleNotificarWhatsApp}
                disabled={notificando}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                {notificando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    📱 Avisar WhatsApp
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Score Operacional */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Score Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className={`text-6xl font-bold ${getScoreColor(analysis?.score?.total || 0)} mb-2`}>
                {analysis?.score?.total || 0}
              </div>
              <p className="text-gray-600">{getScoreLabel(analysis?.score?.total || 0)}</p>
              <Progress 
                value={analysis?.score?.total || 0} 
                className="mt-4 h-3"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-white rounded-lg border">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-gray-600 mb-1">Financeiro</p>
                <p className={`text-lg font-bold ${getScoreColor(analysis?.score?.detalhes?.financeiro || 0)}`}>
                  {analysis?.score?.detalhes?.financeiro || 0}
                </p>
              </div>
              
              <div className="text-center p-3 bg-white rounded-lg border">
                <Zap className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <p className="text-xs text-gray-600 mb-1">Operacional</p>
                <p className={`text-lg font-bold ${getScoreColor(analysis?.score?.detalhes?.operacional || 0)}`}>
                  {analysis?.score?.detalhes?.operacional || 0}
                </p>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border">
                <Truck className="w-5 h-5 mx-auto mb-1 text-orange-600" />
                <p className="text-xs text-gray-600 mb-1">Logística</p>
                <p className={`text-lg font-bold ${getScoreColor(analysis?.score?.detalhes?.logistica || 0)}`}>
                  {analysis?.score?.detalhes?.logistica || 0}
                </p>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border">
                <Users className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                <p className="text-xs text-gray-600 mb-1">RH</p>
                <p className={`text-lg font-bold ${getScoreColor(analysis?.score?.detalhes?.rh || 0)}`}>
                  {analysis?.score?.detalhes?.rh || 0}
                </p>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border">
                <Shield className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                <p className="text-xs text-gray-600 mb-1">Qualidade</p>
                <p className={`text-lg font-bold ${getScoreColor(analysis?.score?.detalhes?.qualidade || 0)}`}>
                  {analysis?.score?.detalhes?.qualidade || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Alertas</p>
                  <p className="text-3xl font-bold text-gray-900">{analysis?.summary.totalAlertas || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Urgentes</p>
                  <p className="text-3xl font-bold text-red-600">{analysis?.summary.alertasUrgentes || 0}</p>
                </div>
                <Zap className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Obras Ativas</p>
                  <p className="text-3xl font-bold text-blue-600">{analysis?.summary.obrasAtivas || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Obras</p>
                  <p className="text-3xl font-bold text-gray-900">{analysis?.summary.totalObras || 0}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Análise e Alertas Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis?.alerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tudo em ordem!</h3>
                <p className="text-gray-600">Nenhum alerta operacional detectado no momento.</p>
              </div>
            ) : (
              analysis?.alerts.map((alert) => {
                const config = alertTypeConfig[alert.type];
                const Icon = alert.icon;
                
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 ${config.bg} ${config.border}`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 ${config.badge} rounded-full flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-semibold ${config.text}`}>{alert.title}</h4>
                        {alert.level && (
                          <Badge variant="outline" className="text-xs">
                            {alert.level}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                      {alert.occurrences_count > 1 && (
                       <div className="mb-2">
                         <Badge variant="outline" className="text-xs bg-gray-100">
                           Detectado {alert.occurrences_count}x nas últimas 24h
                         </Badge>
                       </div>
                      )}
                      {alert.obras && (
                       <div className="flex flex-wrap gap-2 mb-2">
                         {alert.obras.slice(0, 3).map(obra => (
                           <Badge key={obra.id} variant="outline" className="text-xs">
                             {obra.nome}
                           </Badge>
                         ))}
                         {alert.obras.length > 3 && (
                           <Badge variant="outline" className="text-xs">
                             +{alert.obras.length - 3} mais
                           </Badge>
                         )}
                       </div>
                      )}
                    </div>
                    {alert.action && (
                      <Button
                        onClick={alert.action.onClick}
                        size="sm"
                        className="flex-shrink-0"
                      >
                        {alert.action.label}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Ações Rápidas Sugeridas */}
        {analysis?.actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Ações Rápidas Sugeridas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.onClick}
                      className="flex items-center gap-3 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-semibold text-gray-900">{action.label}</span>
                      <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal Configuração WhatsApp */}
        <ConfiguracaoWhatsApp 
          open={showConfig}
          onOpenChange={setShowConfig}
          onConectado={setWhatsappConectado}
        />
      </div>
    </div>
  );
}