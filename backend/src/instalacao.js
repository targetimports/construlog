// CONFIGURAÇÃO INICIAL DA INSTALAÇÃO.
//
// Uma instalação nova nasce vazia: sem empresa, sem estoque, sem caixa. Quem
// cria essa estrutura é o próprio cliente, no primeiro acesso, com os dados
// reais dele — em vez de um seed inventar "Construlog Construções" e usuários
// com senha pública.
//
// A instalação é considerada CONFIGURADA quando existe uma Empresa matriz. Esse
// é o marco natural: sem matriz, o sistema multi-empresa não tem dono.
//
// SEGURANÇA: configurar exige estar logado como admin. O admin nasce do .env
// (SEED_ADMIN_*), então o caminho é: instalar → entrar com o admin → configurar.
// Deixar a configuração aberta a anônimos entregaria a instalação a quem
// achasse a URL primeiro.

import { Router } from 'express';
import { store } from './entityStore.js';
import { query } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();

/** Existe matriz? É o que define instalação configurada. */
export async function instalacaoConfigurada() {
  try {
    const [matriz] = await store.filter('Empresa', { tipo: 'matriz' }, null, 1);
    return !!matriz;
  } catch {
    // Banco fora do ar não é "não configurado" — dizer que sim evitaria mandar
    // uma instalação em produção para a tela de configuração por engano.
    return true;
  }
}

// Público: o front precisa saber, antes do login, se deve mostrar a
// configuração inicial. Não expõe nada além do próprio fato.
router.get('/status', async (_req, res) => {
  res.json({ configurado: await instalacaoConfigurada() });
});

router.post('/configurar', requireAuth, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'somente_admin' });
    }
    if (await instalacaoConfigurada()) {
      // Reconfigurar recriaria a matriz e órfãos todo o resto.
      return res.status(409).json({ error: 'ja_configurada' });
    }

    const b = req.body || {};
    const nome = String(b.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'nome_obrigatorio' });

    // 1) A matriz — dona do estoque central, da frota e da tesouraria central.
    //    Os campos de marca moram aqui: é daqui que sai o /public/branding.
    const matriz = await store.create('Empresa', {
      nome,
      tipo: 'matriz',
      razao_social: String(b.razao_social || nome).trim(),
      cnpj: String(b.cnpj || '').trim(),
      email: String(b.email || '').trim(),
      telefone: String(b.telefone || '').trim(),
      endereco: String(b.endereco || '').trim(),
      whatsapp: String(b.whatsapp || '').trim(),
      nome_sistema: String(b.nome_sistema || nome).trim(),
      logo_url: b.logo_url || null,
      favicon_url: b.favicon_url || null,
      ativa: true,
      saldo_verba: 0,
    });

    // 2) Empresas-membro, se o cliente já souber quais são. Opcional: grupo de
    //    uma empresa só é caso legítimo, e outras podem ser criadas depois.
    const membros = [];
    for (const m of Array.isArray(b.empresas) ? b.empresas : []) {
      const nomeM = String(m?.nome || '').trim();
      if (!nomeM) continue;
      const criada = await store.create('Empresa', {
        nome: nomeM,
        tipo: 'membro',
        razao_social: String(m.razao_social || nomeM).trim(),
        cnpj: String(m.cnpj || '').trim(),
        ativa: true,
        saldo_verba: 0,
      });
      membros.push(criada);
    }

    // 3) Um caixa por empresa, zerado. O saldo real entra pelo sistema.
    const hoje = new Date().toISOString().slice(0, 10);
    for (const e of [matriz, ...membros]) {
      await store.create('ContaTesouraria', {
        nome: `Caixa — ${e.nome}`,
        tipo: 'caixa',
        empresa_id: e.id,
        saldo_inicial: 0,
        saldo_atual: 0,
        data_saldo_inicial: hoje,
        permite_saldo_negativo: false,
        saldo_inicial_bloqueado: false,
        status: 'ativa',
      });
    }

    // 4) Estoque: o CENTRAL do grupo e um almoxarifado por empresa-membro.
    //    Sem eles, a primeira entrada de material não teria onde cair.
    await store.create('LocalEstoque', {
      nome: `Estoque Central — ${nome}`,
      nivel: 'CENTRAL',
      tipo: 'CENTRAL',
      empresa_id: matriz.id,
      ativo: true,
    });
    for (const m of membros) {
      await store.create('LocalEstoque', {
        nome: `Almoxarifado — ${m.nome}`,
        nivel: 'EMPRESA',
        empresa_id: m.id,
        ativo: true,
      });
    }

    // 5) Amarra o admin à matriz com acesso global — senão quem configurou fica
    //    sem enxergar as empresas que acabou de criar.
    await query(
      `UPDATE auth_users SET data = COALESCE(data, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [req.user.id, JSON.stringify({ empresa_id: matriz.id, acesso_global: true })],
    );

    console.log(`[instalacao] configurada: ${nome} (matriz ${matriz.id}, ${membros.length} membro(s))`);

    return res.json({
      ok: true,
      empresa_id: matriz.id,
      empresas_criadas: 1 + membros.length,
    });
  } catch (err) { next(err); }
});

export default router;
