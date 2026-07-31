import { Router } from 'express';
import { store } from './entityStore.js';
import { limitePorIP } from './rateLimit.js';
import { logCliente } from './logger.js';

// API DE INTEGRAÇÃO — o canal entre as instalações dos clientes e este painel.
//
// Cada instância do ERP chama POST /integracao/heartbeat a cada ~30s mandando
// como está (versão, usuários online, obras) e recebe de volta a AUTORIZAÇÃO de
// funcionamento. Negada, a instância se bloqueia sozinha.
//
// Autenticação por chave de API (header X-API-Key), não por JWT: quem chama é um
// servidor, não uma pessoa. A chave é criada em Sistema › Integrações & API.
//
// Cuidado deliberado: em QUALQUER erro deste lado (banco fora, exceção), a
// resposta é "autorizado". Deixar a obra do cliente parada porque o nosso painel
// caiu seria péssimo — o bloqueio existe para inadimplência, não para falha nossa.

const router = Router();

// REGISTRO DO HEARTBEAT — dois destinos, com propósitos diferentes.
//
// 1) ARQUIVO clientes-logs.log: TODO heartbeat, cru. É o log de auditoria para
//    quando algo der errado e você precisar saber o que chegou. Arquivo único,
//    cortado em 10 MB (logger.js) — nunca numerado.
//
// 2) BANCO (LogIntegracao): TODO heartbeat também, porque é o que a tela de
//    Relatórios mostra — e ali o dono do painel quer ver o batimento real, de 30
//    em 30 segundos, não uma amostra. O crescimento da tabela é contido pela
//    poda por idade no agendador (LOG_INTEGRACAO_DIAS, 90 por padrão).
//
// Cheguei a amostrar isto em 5 min para conter a tabela; ficou parecendo que o
// heartbeat tinha diminuído — o relatório é a única janela para esse batimento,
// então rarear a linha é o mesmo que esconder o fato. Se algum dia a tabela
// incomodar, LOG_INTEGRACAO_AMOSTRA_MIN volta a ativar a amostragem; 0 = grava
// tudo (padrão).
const MINUTOS_AMOSTRA = Math.max(0, Number(process.env.LOG_INTEGRACAO_AMOSTRA_MIN || 0));

// Tolerância antes de cortar por atraso. Dá tempo de o boleto compensar e de
// alguém ligar para o cliente antes de derrubar o sistema dele.
const DIAS_TOLERANCIA_PADRAO = 10;

const hojeISO = () => new Date().toISOString().slice(0, 10);

const diasDeAtraso = (vencimento) => {
  if (!vencimento) return 0;
  const ms = Date.now() - new Date(`${String(vencimento).slice(0, 10)}T00:00:00`).getTime();
  return Math.floor(ms / 86400000);
};

/** Decide se a instância pode operar. Retorna { autorizado, motivo, mensagem }. */
async function avaliarAutorizacao(instancia, cliente) {
  // 1) Chave de desligar manual — tem prioridade sobre tudo.
  if (instancia?.bloqueado === true) {
    return {
      autorizado: false,
      motivo: 'bloqueio_manual',
      mensagem: instancia.motivo_bloqueio || 'Acesso suspenso pelo provedor do sistema.',
    };
  }

  // 2) Situação do contrato.
  if (cliente?.status === 'cancelado') {
    return { autorizado: false, motivo: 'contrato_cancelado', mensagem: 'Contrato encerrado.' };
  }
  if (cliente?.status === 'suspenso') {
    return { autorizado: false, motivo: 'contrato_suspenso', mensagem: 'Contrato suspenso. Fale com o suporte.' };
  }

  // 3) Inadimplência — só corta depois da tolerância.
  if (cliente?.id) {
    const cobrancas = await store.filter('Cobranca', { cliente_id: cliente.id }, null, 500);
    const vencidas = cobrancas.filter(
      (c) => c.status !== 'pago' && c.status !== 'cancelado' && String(c.vencimento || '') < hojeISO(),
    );
    if (vencidas.length) {
      const atrasoMaior = Math.max(...vencidas.map((c) => diasDeAtraso(c.vencimento)));
      const tolerancia = Number(cliente.dias_tolerancia ?? DIAS_TOLERANCIA_PADRAO);
      if (atrasoMaior > tolerancia) {
        return {
          autorizado: false,
          motivo: 'inadimplencia',
          mensagem: `Mensalidade em atraso há ${atrasoMaior} dias. Regularize para liberar o acesso.`,
          dias_atraso: atrasoMaior,
        };
      }
      // Ainda dentro da tolerância: libera, mas avisa (a instância pode exibir).
      return {
        autorizado: true,
        motivo: 'ok_com_aviso',
        aviso: `Mensalidade vencida há ${atrasoMaior} dia(s). O acesso será suspenso após ${tolerancia} dias de atraso.`,
        dias_atraso: atrasoMaior,
      };
    }
  }

  return { autorizado: true, motivo: 'ok' };
}

router.post(
  '/heartbeat',
  limitePorIP({ nome: 'heartbeat', janelaMs: 60 * 1000, max: 120, mensagem: 'Muitos heartbeats.' }),
  async (req, res) => {
    // Falhar aberto: nada abaixo pode derrubar o cliente por erro nosso.
    try {
      const chaveRecebida = String(req.header('X-API-Key') || '').trim();
      if (!chaveRecebida) {
        return res.status(401).json({ autorizado: true, motivo: 'sem_chave', mensagem: 'Chave de API ausente.' });
      }

      const [chave] = await store.filter('ChaveApi', { chave: chaveRecebida }, null, 1);
      if (!chave || chave.status !== 'ativa') {
        return res.status(401).json({
          autorizado: false,
          motivo: 'chave_invalida',
          mensagem: 'Chave de acesso inválida ou revogada.',
        });
      }

      const corpo = req.body || {};
      const url = String(corpo.url || '').replace(/\/+$/, '');

      // Acha a instância: pelo id informado, senão pela URL, senão pela chave.
      let instancia = null;
      if (corpo.instancia_id) {
        instancia = (await store.filter('InstanciaCliente', { id: String(corpo.instancia_id) }, null, 1))[0] || null;
      }
      if (!instancia && url) {
        const todas = await store.filter('InstanciaCliente', {}, null, 500);
        instancia = todas.find((i) => String(i.url || '').replace(/\/+$/, '') === url) || null;
      }
      if (!instancia && chave.cliente_id) {
        const doCliente = await store.filter('InstanciaCliente', { cliente_id: chave.cliente_id }, null, 1);
        instancia = doCliente[0] || null;
      }

      // Instância nova avisando pela primeira vez: registra sozinha, para não
      // exigir cadastro manual antes de o cliente conseguir rodar.
      if (!instancia && url) {
        instancia = await store.create('InstanciaCliente', {
          cliente_id: chave.cliente_id || null,
          cliente_nome: chave.cliente_nome || null,
          nome: corpo.nome || url,
          url,
          ambiente: corpo.ambiente || 'producao',
          versao: corpo.versao || null,
          status: 'online',
          origem: 'auto_heartbeat',
        });
      }

      const cliente = instancia?.cliente_id
        ? (await store.filter('ClienteSaaS', { id: instancia.cliente_id }, null, 1))[0] || null
        : (chave.cliente_id ? (await store.filter('ClienteSaaS', { id: chave.cliente_id }, null, 1))[0] || null : null);

      const decisao = await avaliarAutorizacao(instancia, cliente);
      const agora = new Date().toISOString();

      // Log cru: todo heartbeat, sempre, no arquivo.
      logCliente({
        tipo: 'heartbeat',
        instancia: instancia?.nome || url || null,
        cliente: cliente?.nome || chave.cliente_nome || null,
        autorizado: decisao.autorizado,
        motivo: decisao.motivo,
        usuarios_online: Number(corpo.usuarios_online) || 0,
        usuarios_total: Number(corpo.usuarios_total) || 0,
        obras_ativas: Number(corpo.obras_ativas) || 0,
        versao: corpo.versao || null,
      });

      // Guarda o retrato mais recente da instalação.
      if (instancia?.id) {
        // Mudou de estado? Isso nunca pode ficar só no arquivo.
        const mudouEstado = instancia.status !== 'online'
          || instancia.autorizado !== decisao.autorizado
          || instancia.motivo_ultima_decisao !== decisao.motivo;

        // Passou o intervalo da amostra desde o último registro no banco?
        const ultimoNoBanco = instancia.ultimo_log_em ? new Date(instancia.ultimo_log_em).getTime() : 0;
        const naHoraDaAmostra = MINUTOS_AMOSTRA === 0
          || (Date.now() - ultimoNoBanco) >= MINUTOS_AMOSTRA * 60_000;

        const gravarNoBanco = mudouEstado || naHoraDaAmostra;

        await store.update('InstanciaCliente', instancia.id, {
          status: 'online',
          versao: corpo.versao || instancia.versao || null,
          ultimo_heartbeat: agora,
          ultimo_teste: agora,
          ultimo_erro: null,
          ...(gravarNoBanco ? { ultimo_log_em: agora } : {}),
          metricas: {
            usuarios_online: Number(corpo.usuarios_online) || 0,
            usuarios_total: Number(corpo.usuarios_total) || 0,
            obras_ativas: Number(corpo.obras_ativas) || 0,
            obras_total: Number(corpo.obras_total) || 0,
            // Valor sob gestão (soma dos contratos das obras da instalação).
            valor_obras: Number(corpo.valor_obras) || 0,
            atualizado_em: agora,
          },
          autorizado: decisao.autorizado,
          motivo_ultima_decisao: decisao.motivo,
        });

        await store.update('ChaveApi', chave.id, { ultimo_uso: agora });

        if (gravarNoBanco) {
          await store.create('LogIntegracao', {
            instancia_id: instancia.id,
            instancia_nome: instancia.nome || url,
            cliente_id: cliente?.id || null,
            cliente_nome: cliente?.nome || null,
            tipo: 'heartbeat',
            status: 'online',
            autorizado: decisao.autorizado,
            motivo: decisao.motivo,
            // Marca a linha que entrou por mudança de estado: no relatório é o
            // que interessa olhar primeiro.
            mudanca_de_estado: mudouEstado || undefined,
            usuarios_online: Number(corpo.usuarios_online) || 0,
            obras_ativas: Number(corpo.obras_ativas) || 0,
            testado_em: agora,
          });
        }
      }

      return res.json({
        autorizado: decisao.autorizado,
        motivo: decisao.motivo,
        mensagem: decisao.mensagem || null,
        aviso: decisao.aviso || null,
        dias_atraso: decisao.dias_atraso ?? null,
        instancia_id: instancia?.id || null,
        // De quanto em quanto tempo voltar a falar (segundos).
        intervalo_sugerido: 30,
        servidor_em: agora,
      });
    } catch (e) {
      console.error('[heartbeat] falha:', e?.message);
      return res.json({
        autorizado: true,
        motivo: 'erro_no_painel',
        mensagem: null,
        intervalo_sugerido: 60,
      });
    }
  },
);

export default router;
