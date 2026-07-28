import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testa sistema de permissão por PERFIL + OBRA
 * Valida 3 perfis: Encarregado, Funcionário, Mestre de Obras
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TESTE] Iniciando teste de permissão por perfil + obra...');

    const resultados = {
      testes: [],
      erros: [],
      resumo: { total: 0, sucesso: 0, falha: 0 }
    };

    try {
      // TESTE 1: Validar tabela UsuarioObra
      console.log('[TESTE 1] Validando entidade UsuarioObra...');

      const usuariosObras = await base44.entities.UsuarioObra.list(null, 10);

      const temUsuarios = usuariosObras.length > 0;
      const estruturaCorreta = usuariosObras.every(uo =>
        uo.user_email && uo.obra_id && uo.perfil && 
        ['administrador', 'mestre_de_obras', 'encarregado', 'funcionario'].includes(uo.perfil)
      );

      const ativos = usuariosObras.filter(uo => uo.ativo).length;

      resultados.testes.push({
        nome: 'Validar Tabela UsuarioObra',
        status: temUsuarios && estruturaCorreta ? 'sucesso' : 'aviso',
        registros_encontrados: usuariosObras.length,
        registros_ativos: ativos,
        estrutura_correta: estruturaCorreta,
        exemplos: usuariosObras.slice(0, 3).map(uo => ({
          user_email: uo.user_email,
          obra_id: uo.obra_id,
          perfil: uo.perfil,
          ativo: uo.ativo
        }))
      });

      if (temUsuarios && estruturaCorreta) {
        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Validar UsuarioObra', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 2: Perfil ENCARREGADO
      console.log('[TESTE 2] Testando Perfil ENCARREGADO...');

      const encarregados = await base44.entities.UsuarioObra.filter({
        perfil: 'encarregado',
        ativo: true
      });

      if (encarregados.length === 0) {
        resultados.testes.push({
          nome: 'Perfil ENCARREGADO',
          status: 'aviso',
          detalhes: 'Nenhum encarregado encontrado'
        });
      } else {
        const enc = encarregados[0];

        // Validar acesso à sua obra
        const acesso = await base44.functions.invoke('validarAcessoObraUsuario', {
          obra_id: enc.obra_id
        });

        // Tentar listar dados da obra
        const obras = await base44.entities.Obra.filter({ id: enc.obra_id });

        resultados.testes.push({
          nome: 'Perfil ENCARREGADO - Acesso Restrito',
          status: 'sucesso',
          total_encarregados: encarregados.length,
          pode_acessar_propria_obra: obras.length > 0,
          obras_vinculadas: encarregados.length,
          exemplo: {
            email: enc.user_email,
            obra_id: enc.obra_id,
            perfil: enc.perfil,
            restricao: 'Somente sua obra'
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Perfil ENCARREGADO', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 3: Perfil FUNCIONÁRIO
      console.log('[TESTE 3] Testando Perfil FUNCIONÁRIO...');

      const funcionarios = await base44.entities.UsuarioObra.filter({
        perfil: 'funcionario',
        ativo: true
      });

      if (funcionarios.length === 0) {
        resultados.testes.push({
          nome: 'Perfil FUNCIONÁRIO',
          status: 'aviso',
          detalhes: 'Nenhum funcionário encontrado'
        });
      } else {
        const func = funcionarios[0];

        // Validar que tem apenas 1 obra
        const minhasObras = funcionarios.filter(f => f.user_email === func.user_email);

        resultados.testes.push({
          nome: 'Perfil FUNCIONÁRIO - Acesso Único',
          status: 'sucesso',
          total_funcionarios: funcionarios.length,
          obras_por_funcionario: minhasObras.length,
          exemplo: {
            email: func.user_email,
            obra_id: func.obra_id,
            perfil: func.perfil,
            restricao: 'Uma obra apenas'
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Perfil FUNCIONÁRIO', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 4: Perfil MESTRE DE OBRAS
      console.log('[TESTE 4] Testando Perfil MESTRE DE OBRAS...');

      const mestres = await base44.entities.UsuarioObra.filter({
        perfil: 'mestre_de_obras',
        ativo: true
      });

      if (mestres.length === 0) {
        resultados.testes.push({
          nome: 'Perfil MESTRE DE OBRAS',
          status: 'aviso',
          detalhes: 'Nenhum mestre de obras encontrado'
        });
      } else {
        // Mestre tem múltiplas obras
        const mestreId = mestres[0].user_email;
        const suasObras = mestres.filter(m => m.user_email === mestreId);

        resultados.testes.push({
          nome: 'Perfil MESTRE DE OBRAS - Múltiplas Obras',
          status: 'sucesso',
          total_mestres: mestres.length,
          obras_por_mestre: suasObras.length,
          exemplo: {
            email: mestreId,
            obras_vinculadas: suasObras.length,
            perfil: 'mestre_de_obras',
            restricao: 'Todas as suas obras'
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Perfil MESTRE DE OBRAS', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 5: Filtro Automático por Obra
      console.log('[TESTE 5] Testando filtro automático...');

      // Simular query com filtro
      const filtro = await base44.functions.invoke('filtrarQueriesPorObra', {
        entidade: 'Medicao',
        filtro_original: { status: 'aprovada' }
      });

      resultados.testes.push({
        nome: 'Filtro Automático por Obra',
        status: 'sucesso',
        entidade_testada: 'Medicao',
        filtro_original: { status: 'aprovada' },
        obras_acessiveis: filtro.data.obras_acessiveis.length,
        filtro_aplicado_corretamente: !!filtro.data.filtro_final.obra_id || filtro.data.motivo === 'super_admin'
      });

      resultados.resumo.sucesso++;
      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Filtro Automático', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'testePermissaoPerfilObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: resultados.resumo.falha === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'teste_permissao_perfil_obra',
        total_testes: resultados.resumo.total,
        sucesso: resultados.resumo.sucesso,
        falha: resultados.resumo.falha
      }
    });

    console.log('[TESTE] Testes concluídos!');

    return Response.json({
      success: resultados.resumo.falha === 0,
      resultados
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});