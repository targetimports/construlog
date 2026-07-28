import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2, ArrowRight, MessageCircle, Settings, CheckCircle2, Bell, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ConfiguracaoWhatsApp from './ConfiguracaoWhatsApp';
import { toast } from 'sonner';

const FILTROS_FUNCAO = {
  motorista: {
    titulo: 'Supervisor - Logística',
    monitor: ['veiculos', 'abastecimentos', 'viagens'],
    checklist: ['Veículo vinculado?', 'Abastecimento atualizado?', 'Viagem registrada?']
  },
  engenheiro: {
    titulo: 'Supervisor - Engenharia',
    monitor: ['obras', 'medicoes', 'cronograma', 'qualidade'],
    checklist: ['Cronograma atualizado?', 'Medição registrada?', 'Documentação completa?']
  },
  arquiteto: {
    titulo: 'Supervisor - Arquitetura',
    monitor: ['obras', 'cronograma', 'projetos'],
    checklist: ['Projeto validado?', 'Plantas atualizadas?', 'Revisões marcadas?']
  },
  mestre_obras: {
    titulo: 'Supervisor - Mestre de Obras',
    monitor: ['obras', 'colaboradores', 'equipamentos', 'seguranca'],
    checklist: ['Equipe alocada?', 'Equipamentos liberados?', 'Segurança checada?']
  },
  estoquista: {
    titulo: 'Supervisor - Estoque',
    monitor: ['estoque', 'materiais', 'movimentacoes'],
    checklist: ['Estoque conferido?', 'Materiais baixos?', 'Entrada registrada?']
  },
  almoxarife: {
    titulo: 'Supervisor - Almoxarife',
    monitor: ['estoque', 'materiais', 'requisicoes'],
    checklist: ['Requisições pendentes?', 'Estoque mínimo ok?', 'Inventário atualizado?']
  },
  financeiro: {
    titulo: 'Supervisor - Financeiro',
    monitor: ['financeiro', 'contas', 'pagamentos', 'orcamento'],
    checklist: ['Contas em dia?', 'Orçamento ok?', 'Pagamentos programados?']
  },
  compras: {
    titulo: 'Supervisor - Compras',
    monitor: ['compras', 'fornecedores', 'orcamento'],
    checklist: ['Requisições aprovadas?', 'Cotações recebidas?', 'OC emitida?']
  },
  admin: {
    titulo: 'Supervisor Completo',
    monitor: ['tudo'],
    checklist: ['Tudo checado?']
  }
};

export default function SupervisorIAFuncao({ funcao = 'admin' }) {
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [whatsappConectado, setWhatsappConectado] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  const config = FILTROS_FUNCAO[funcao] || FILTROS_FUNCAO.admin;

  // Carregar alertas dispensados do localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem('dismissed_alerts');
    if (dismissed) {
      setDismissedAlerts(JSON.parse(dismissed));
    }
  }, []);

  // Função para dispensar um alerta
  const dismissAlert = (alertTitle) => {
    const newDismissed = [...dismissedAlerts, alertTitle];
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissed_alerts', JSON.stringify(newDismissed));
  };

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

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

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.MedicaoObra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: materiaisEstoque = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: impostos = [] } = useQuery({
    queryKey: ['impostos'],
    queryFn: () => base44.entities.Imposto.list()
  });

  const { data: orcamentosDetalhados = [] } = useQuery({
    queryKey: ['orcamentos-detalhados'],
    queryFn: () => base44.entities.Orcamento.list()
  });

  useEffect(() => {
    const conectado = localStorage.getItem('whatsapp_conectado') === 'true';
    setWhatsappConectado(conectado);
  }, []);

  // Função para criar ou atualizar alerta com deduplicação e cooldown 24h
  const createOrUpdateAlert = async (alertData, funcaoAlvo) => {
    const now = new Date().toISOString();
    const cooldownHours = 24;

    try {
      // Buscar alerta existente com mesmo alert_key
      const existingAlerts = await base44.entities.AlertaSupervisor.filter({
        alert_key: alertData.alert_key,
        funcao_alvo: funcaoAlvo,
        status: 'OPEN'
      });

      const existing = existingAlerts[0];

      if (existing) {
        const lastSeenDate = new Date(existing.last_seen_at);
        const hoursSinceLastSeen = (new Date(now) - lastSeenDate) / (1000 * 60 * 60);

        // Se está dentro do cooldown (< 24h), apenas atualizar
        if (hoursSinceLastSeen < cooldownHours) {
          await base44.entities.AlertaSupervisor.update(existing.id, {
            last_seen_at: now,
            occurrences_count: (existing.occurrences_count || 1) + 1,
            message: alertData.message, // atualizar mensagem caso tenha mudado
            context_json: alertData.context_json
          });
          return existing.id;
        }
      }

      // Criar novo alerta (primeiro ou após cooldown)
      const cooldownUntil = new Date(new Date(now).getTime() + cooldownHours * 60 * 60 * 1000).toISOString();
      
      const newAlert = await base44.entities.AlertaSupervisor.create({
        ...alertData,
        funcao_alvo: funcaoAlvo,
        first_seen_at: now,
        last_seen_at: now,
        cooldown_until: cooldownUntil,
        occurrences_count: 1,
        status: 'OPEN'
      });

      return newAlert.id;
    } catch (error) {
      console.error('Erro ao criar/atualizar alerta:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;

    setAnalyzing(true);
    setTimeout(async () => {
      const alerts = [];
      
      // Função para enviar notificação (push ou WhatsApp) de alertas críticos
      const enviarNotificacaoSeHaCritico = async (alertsList) => {
        const temCritico = alertsList.some(a => a.type === 'critical');
        if (!temCritico) return;

        const alertasCriticos = alertsList.filter(a => a.type === 'critical');
        const prefereWhatsApp = user?.notificacao_preferencia === 'whatsapp';

        for (const alerta of alertasCriticos.slice(0, 3)) {
          try {
            if (prefereWhatsApp && user?.phone) {
              // Enviar via WhatsApp
              await base44.functions.invoke('enviarWhatsAppAlerta', {
                titulo: `⚠️ ALERTA CRÍTICO`,
                mensagem: `${alerta.title}\n\n${alerta.description}`,
                tipo: 'critico'
              });
            } else if (user?.push_notification_tokens?.length > 0) {
              // Enviar via push notification
              await base44.functions.invoke('enviarPushNotificacao', {
                titulo: `⚠️ ALERTA CRÍTICO - ${config.titulo}`,
                corpo: alerta.title,
                tipo_alerta: 'critico',
                url_acao: window.location.pathname,
                dados_adicionais: {
                  nivel: alerta.level
                }
              });
            }
          } catch (error) {
            console.error('Erro ao enviar notificação:', error);
          }
        }
      };

      // ==================== MOTORISTA ====================
      if (funcao === 'motorista' || funcao === 'admin') {
        const veiculo_motorista = veiculos.find(v => v.motorista_responsavel === user.full_name);
        
        if (!veiculo_motorista && funcao === 'motorista') {
          const alertData = {
            alert_key: 'MOTORISTA_SEM_VEICULO:GLOBAL',
            severity: 'MEDIO',
            type: 'warning',
            level: 'ATENÇÃO',
            title: 'Nenhum veículo atribuído',
            message: 'Solicite atribuição de um veículo para começar',
            context_json: { user_id: user.id }
          };
          await createOrUpdateAlert(alertData, funcao);
          alerts.push(alertData);
        }

        const viagens_motorista = viagens.filter(v => v.motorista_id === user.id);
        if (viagens_motorista.length === 0 && funcao === 'motorista') {
          alerts.push({
            type: 'info',
            level: 'INFO',
            title: 'Nenhuma viagem registrada',
            description: 'Registre suas viagens para análise de consumo'
          });
        }

        if (veiculo_motorista) {
          const abast_veiculo = abastecimentos.filter(a => a.veiculo_id === veiculo_motorista.id);
          if (abast_veiculo.length === 0) {
            alerts.push({
              type: 'info',
              level: 'INFO',
              title: 'Abastecimento não registrado',
              description: 'Registre o último abastecimento'
            });
          }
        }
      }

      // ==================== ENGENHEIRO ====================
      if (funcao === 'engenheiro' || funcao === 'admin') {
        const medicoes_pendentes = medicoes.filter(m => m.status === 'pendente');
        if (medicoes_pendentes.length > 0) {
          alerts.push({
            type: 'warning',
            level: 'ATENÇÃO',
            title: `${medicoes_pendentes.length} medição(ões) pendente(s)`,
            description: 'Approve medições para faturamento'
          });
        }

        for (const obra of obras) {
          if (obra.status === 'em_andamento' && (!obra.data_inicio || !obra.data_prevista_fim)) {
            const alertData = {
              alert_key: `CRONOGRAMA_INCOMPLETO:OBRA:${obra.id}`,
              severity: 'MEDIO',
              type: 'warning',
              level: 'ATENÇÃO',
              title: `${obra.nome}: Cronograma incompleto`,
              message: 'Defina datas de início e conclusão',
              context_json: { obra_id: obra.id, obra_nome: obra.nome }
            };
            await createOrUpdateAlert(alertData, funcao);
            alerts.push(alertData);
          }
        }
      }

      // ==================== ARQUITETO ====================
      if (funcao === 'arquiteto' || funcao === 'admin') {
        for (const obra of obras) {
          if (!obra.descricao || !obra.foto_capa) {
            const alertData = {
              alert_key: `DOC_INCOMPLETA:OBRA:${obra.id}`,
              severity: 'BAIXO',
              type: 'info',
              level: 'INFO',
              title: `${obra.nome}: Documentação incompleta`,
              message: 'Adicione descrição e fotos do projeto',
              context_json: { obra_id: obra.id, obra_nome: obra.nome }
            };
            await createOrUpdateAlert(alertData, funcao);
            alerts.push(alertData);
          }
        }
      }

      // ==================== MESTRE DE OBRAS ====================
      if (funcao === 'mestre_obras' || funcao === 'admin') {
        const obrasAtivas = obras.filter(o => o.status === 'em_andamento');
        const obrasSemColaboradores = obrasAtivas.filter(obra => {
          const temColaborador = colaboradores.some(col => 
            col.obra_atual_id === obra.id && col.status === 'ativo'
          );
          return !temColaborador;
        });

        if (obrasSemColaboradores.length > 0) {
          const alertData = {
            alert_key: 'OBRA_SEM_EQUIPE:GLOBAL',
            severity: 'CRITICO',
            type: 'critical',
            level: 'CRÍTICO',
            title: 'Obras sem equipe alocada',
            message: `${obrasSemColaboradores.length} obra(s) precisa(m) de colaboradores. Alocar é essencial.`,
            context_json: { 
              count: obrasSemColaboradores.length,
              obra_ids: obrasSemColaboradores.map(o => o.id)
            }
          };
          await createOrUpdateAlert(alertData, funcao);
          alerts.push(alertData);
        }
      }

      // ==================== ESTOQUISTA / ALMOXARIFE ====================
      if ((funcao === 'estoquista' || funcao === 'almoxarife' || funcao === 'admin')) {
        const materiaisBaixo = materiaisEstoque.filter(m => 
          m.estoque_atual > 0 && m.estoque_minimo > 0 && m.estoque_atual <= m.estoque_minimo
        );

        if (materiaisBaixo.length > 0) {
          alerts.push({
            type: 'warning',
            level: 'ATENÇÃO',
            title: `${materiaisBaixo.length} material(is) com estoque baixo`,
            description: 'Repor estoque para evitar paralisações'
          });
        }
      }

      // ==================== FINANCEIRO ====================
      if (funcao === 'financeiro' || funcao === 'admin') {
        const hoje = new Date();
        const contasAtrasadas = contas.filter(c => {
          if (!c.data_vencimento || c.status !== 'pendente' || c.tipo !== 'pagar') return false;
          return new Date(c.data_vencimento) < hoje;
        });

        if (contasAtrasadas.length > 0) {
          const alertData = {
            alert_key: 'CONTAS_ATRASADAS:GLOBAL',
            severity: 'CRITICO',
            type: 'critical',
            level: 'URGENTE',
            title: `${contasAtrasadas.length} conta(s) atrasada(s)`,
            message: 'Regularizar pagamentos',
            context_json: { 
              count: contasAtrasadas.length,
              conta_ids: contasAtrasadas.map(c => c.id)
            }
          };
          await createOrUpdateAlert(alertData, funcao);
          alerts.push(alertData);
        }

        // Validar Impostos com Orçamento
        impostos.forEach(imp => {
          const orc = orcamentosDetalhados.find(o => o.id === imp.orcamento_id);
          if (orc) {
            const percentualImposto = (imp.valor / orc.valor_total) * 100;
            if (percentualImposto > 30) {
              alerts.push({
                type: percentualImposto > 40 ? 'critical' : 'warning',
                level: percentualImposto > 40 ? 'CRÍTICO' : 'ATENÇÃO',
                title: `Imposto ${percentualImposto.toFixed(1)}% em ${orc.nome}`,
                description: `Imposto de R$ ${imp.valor.toLocaleString('pt-BR')} vinculado ao orçamento`
              });
            }
          }
        });

        orcamentos.forEach(orc => {
          const obra = obras.find(o => o.id === orc.obra_id);
          if (obra && obra.valor_realizado > orc.valor_total) {
            const desvio = ((obra.valor_realizado - orc.valor_total) / orc.valor_total) * 100;
            if (desvio > 15) {
              alerts.push({
                type: desvio > 25 ? 'critical' : 'warning',
                level: desvio > 25 ? 'CRÍTICO' : 'ATENÇÃO',
                title: `Desvio de ${desvio.toFixed(1)}% em ${obra.nome}`,
                description: 'Revisar custos'
              });
            }
          }
        });
      }

      // Filtrar alertas dispensados
      const alertsNaoDismissed = alerts.filter(a => !dismissedAlerts.includes(a.title));

      // Buscar alertas do banco com occurrences_count
      const alertasDb = await base44.entities.AlertaSupervisor.filter({
        funcao_alvo: funcao,
        status: 'OPEN'
      });

      // Enriquecer alertas com occurrences_count do banco
      const alertsEnriquecidos = alertsNaoDismissed.map(alert => {
        const alertDb = alertasDb.find(db => db.alert_key === alert.alert_key);
        return {
          ...alert,
          occurrences_count: alertDb?.occurrences_count || 1,
          db_id: alertDb?.id
        };
      });

      // Ordenar por severidade e recência
      const alertsOrdenados = alertsEnriquecidos.sort((a, b) => {
        const severityOrder = { CRITICO: 4, ALTO: 3, MEDIO: 2, BAIXO: 1 };
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        // Dentro da mesma severidade, mais recente primeiro
        return 0; // Como são novos, manter ordem
      });

      setAnalysis({
        alerts: alertsOrdenados.slice(0, 3), // Limitar a 3 no dashboard
        total: alertsNaoDismissed.length,
        allAlerts: alertsOrdenados // Guardar todos para o modal
      });

      // Enviar notificação para alertas críticos
      await enviarNotificacaoSeHaCritico(alerts);

      setAnalyzing(false);
    }, 800);
  }, [funcao, user, obras, orcamentos, colaboradores, veiculos, abastecimentos, viagens, medicoes, contas, materiaisEstoque, impostos, orcamentosDetalhados, dismissedAlerts]);

  if (analyzing) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6 flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
          <p className="text-sm text-gray-600">Analisando...</p>
        </CardContent>
      </Card>
    );
  }

  const alertTypeConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500' }
  };

  return (
    <>
      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{config.titulo}</CardTitle>
          <div className="flex items-center gap-2">
            {user?.notificacao_preferencia === 'whatsapp' && user?.phone && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-300">
                <MessageCircle className="w-3 h-3 text-green-600 mr-1" />
                WhatsApp
              </Badge>
            )}
            {user?.push_notification_tokens?.length > 0 && user?.notificacao_preferencia !== 'whatsapp' && (
              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300">
                <Bell className="w-3 h-3 text-blue-600 mr-1" />
                Push Ativo
              </Badge>
            )}
            {analysis.total > 0 && (
              <Button
                onClick={() => setShowConfig(true)}
                variant="ghost"
                size="sm"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {analysis.total === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Tudo em ordem!
            </div>
          ) : (
            <>
              {analysis.alerts.map((alert, idx) => {
                const config = alertTypeConfig[alert.type];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${config.bg} ${config.border} relative group`}
                  >
                    <div className="flex items-start gap-2">
                     <AlertTriangle className={`w-4 h-4 ${config.text} flex-shrink-0 mt-0.5`} />
                     <div className="flex-1 min-w-0">
                       <p className={`text-sm font-semibold ${config.text}`}>{alert.title}</p>
                       <p className="text-xs text-gray-600 mt-0.5">{alert.message || alert.description}</p>
                       {alert.occurrences_count > 1 && (
                         <p className="text-xs text-gray-500 mt-1">
                           Detectado {alert.occurrences_count}x hoje
                         </p>
                       )}
                     </div>
                      <button
                        onClick={() => dismissAlert(alert.title)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-gray-400 hover:text-gray-600"
                        title="Não mostrar novamente"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {analysis.total > 3 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => navigate(createPageUrl('SupervisorOperacional'))}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    +{analysis.total - 3} mais alerta{analysis.total - 3 > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfiguracaoWhatsApp 
        open={showConfig}
        onOpenChange={setShowConfig}
        onConectado={setWhatsappConectado}
      />
    </>
  );
}